#import "iOSEqualizerModule.h"
#import <React/RCTBridge.h>
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>
#import <MediaToolbox/MediaToolbox.h>
#import <math.h>

#pragma mark - Biquad Filter Types

typedef struct {
  float b0, b1, b2, a1, a2;
} BiquadCoeffs;

#define EQ_NUM_BANDS 10
#define EQ_MAX_CHANNELS 8

typedef struct {
  BiquadCoeffs coeffs[EQ_NUM_BANDS];
  float state[EQ_MAX_CHANNELS][EQ_NUM_BANDS][4]; // x1, x2, y1, y2
  BOOL enabled;
  volatile BOOL needsUpdate;
  float pendingGains[EQ_NUM_BANDS];
  float sampleRate;
  BOOL isNonInterleaved;
  UInt32 channelsPerFrame;
} EQProcessorContext;

static EQProcessorContext *sEQCtx = NULL;

static const float sFreqs[EQ_NUM_BANDS] = {
  32.0f, 64.0f, 125.0f, 250.0f, 500.0f,
  1000.0f, 2000.0f, 4000.0f, 8000.0f, 16000.0f
};

#pragma mark - Biquad Coefficient Computation (Peaking EQ)

static BiquadCoeffs computePeakingEQ(float freq, float gainDB, float Q, float sr) {
  BiquadCoeffs c = {1.0f, 0.0f, 0.0f, 0.0f, 0.0f};
  if (fabsf(gainDB) < 0.05f) return c;

  float A = powf(10.0f, gainDB / 40.0f);
  float w0 = 2.0f * (float)M_PI * freq / sr;
  float cosw0 = cosf(w0);
  float sinw0 = sinf(w0);
  float alpha = sinw0 / (2.0f * Q);

  float b0 = 1.0f + alpha * A;
  float b1 = -2.0f * cosw0;
  float b2 = 1.0f - alpha * A;
  float a0 = 1.0f + alpha / A;
  float a1 = -2.0f * cosw0;
  float a2 = 1.0f - alpha / A;

  c.b0 = b0 / a0;
  c.b1 = b1 / a0;
  c.b2 = b2 / a0;
  c.a1 = a1 / a0;
  c.a2 = a2 / a0;
  return c;
}

static void recalcCoefficients(EQProcessorContext *ctx) {
  for (int i = 0; i < EQ_NUM_BANDS; i++) {
    ctx->coeffs[i] = computePeakingEQ(sFreqs[i], ctx->pendingGains[i], 1.5f, ctx->sampleRate);
  }
  memset(ctx->state, 0, sizeof(ctx->state));
  ctx->needsUpdate = NO;
}

#pragma mark - MTAudioProcessingTap Callbacks

static void eqTapInit(MTAudioProcessingTapRef tap, void *clientInfo, void **tapStorageOut) {
  *tapStorageOut = clientInfo;
}

static void eqTapFinalize(MTAudioProcessingTapRef tap) {}

static void eqTapPrepare(MTAudioProcessingTapRef tap, CMItemCount maxFrames,
                          const AudioStreamBasicDescription *fmt) {
  EQProcessorContext *ctx = sEQCtx;
  if (!ctx) return;
  ctx->sampleRate = fmt->mSampleRate;
  ctx->isNonInterleaved = (fmt->mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0;
  ctx->channelsPerFrame = fmt->mChannelsPerFrame;
  recalcCoefficients(ctx);
  RCTLogInfo(@"[EQ] Tap prepared: sr=%.0f ch=%u nonInterleaved=%d",
             fmt->mSampleRate, (unsigned)fmt->mChannelsPerFrame, ctx->isNonInterleaved);
}

static void eqTapUnprepare(MTAudioProcessingTapRef tap) {}

static void eqTapProcess(MTAudioProcessingTapRef tap, CMItemCount numberFrames,
                          MTAudioProcessingTapFlags flags,
                          AudioBufferList *bufferListInOut,
                          CMItemCount *numberFramesOut,
                          MTAudioProcessingTapFlags *flagsOut) {
  OSStatus status = MTAudioProcessingTapGetSourceAudio(
      tap, numberFrames, bufferListInOut, flagsOut, NULL, numberFramesOut);
  if (status != noErr) return;

  EQProcessorContext *ctx = sEQCtx;
  if (!ctx || !ctx->enabled) return;

  if (ctx->needsUpdate) {
    recalcCoefficients(ctx);
  }

  UInt32 numBuffers = bufferListInOut->mNumberBuffers;

  for (UInt32 bufIdx = 0; bufIdx < numBuffers && bufIdx < EQ_MAX_CHANNELS; bufIdx++) {
    float *data = (float *)bufferListInOut->mBuffers[bufIdx].mData;
    UInt32 numSamples = bufferListInOut->mBuffers[bufIdx].mDataByteSize / sizeof(float);

    if (ctx->isNonInterleaved) {
      for (int band = 0; band < EQ_NUM_BANDS; band++) {
        BiquadCoeffs *c = &ctx->coeffs[band];
        if (fabsf(c->b0 - 1.0f) < 0.0001f && fabsf(c->b1) < 0.0001f &&
            fabsf(c->b2) < 0.0001f && fabsf(c->a1) < 0.0001f && fabsf(c->a2) < 0.0001f)
          continue;

        float x1 = ctx->state[bufIdx][band][0];
        float x2 = ctx->state[bufIdx][band][1];
        float y1 = ctx->state[bufIdx][band][2];
        float y2 = ctx->state[bufIdx][band][3];

        for (UInt32 i = 0; i < numSamples; i++) {
          float x = data[i];
          float y = c->b0 * x + c->b1 * x1 + c->b2 * x2 - c->a1 * y1 - c->a2 * y2;
          x2 = x1; x1 = x;
          y2 = y1; y1 = y;
          data[i] = y;
        }

        ctx->state[bufIdx][band][0] = x1;
        ctx->state[bufIdx][band][1] = x2;
        ctx->state[bufIdx][band][2] = y1;
        ctx->state[bufIdx][band][3] = y2;
      }
    } else {
      UInt32 ch = ctx->channelsPerFrame;
      if (ch == 0) ch = 1;
      UInt32 frames = numSamples / ch;
      for (UInt32 c_idx = 0; c_idx < ch && c_idx < EQ_MAX_CHANNELS; c_idx++) {
        for (int band = 0; band < EQ_NUM_BANDS; band++) {
          BiquadCoeffs *coeff = &ctx->coeffs[band];
          if (fabsf(coeff->b0 - 1.0f) < 0.0001f && fabsf(coeff->b1) < 0.0001f &&
              fabsf(coeff->b2) < 0.0001f && fabsf(coeff->a1) < 0.0001f &&
              fabsf(coeff->a2) < 0.0001f)
            continue;

          float x1 = ctx->state[c_idx][band][0];
          float x2 = ctx->state[c_idx][band][1];
          float y1 = ctx->state[c_idx][band][2];
          float y2 = ctx->state[c_idx][band][3];

          for (UInt32 i = 0; i < frames; i++) {
            UInt32 idx = i * ch + c_idx;
            float x = data[idx];
            float y = coeff->b0 * x + coeff->b1 * x1 + coeff->b2 * x2
                    - coeff->a1 * y1 - coeff->a2 * y2;
            x2 = x1; x1 = x;
            y2 = y1; y1 = y;
            data[idx] = y;
          }

          ctx->state[c_idx][band][0] = x1;
          ctx->state[c_idx][band][1] = x2;
          ctx->state[c_idx][band][2] = y1;
          ctx->state[c_idx][band][3] = y2;
        }
      }
    }
  }
}

#pragma mark - EQ Preset Definitions (10-band gains in dB)

typedef struct { float g[EQ_NUM_BANDS]; } EQPreset;

static EQPreset getIOSPreset(int pid) {
  switch (pid) {
    case 1:  return (EQPreset){{3,  4,  2,  0, -1,  0,  1,  3,  5,  6}};   // 3D丽音
    case 2:  return (EQPreset){{3,  4,  3,  5,  4,  3,  2,  2,  3,  2}};   // 爵士
    case 3:  return (EQPreset){{-1, 0,  1,  3,  5,  6,  5,  3,  1, -1}};   // 流行
    case 4:  return (EQPreset){{5,  6,  4,  2, -1,  0,  2,  4,  6,  7}};   // 摇滚
    case 5:  return (EQPreset){{4,  5,  3,  1,  0,  0,  1,  3,  5,  6}};   // 古典
    case 6:  return (EQPreset){{7,  8,  6,  4,  1,  0,  1,  2,  3,  3}};   // 嘻哈
    case 7:  return (EQPreset){{6,  7,  4,  2, -1,  0,  1,  3,  6,  8}};   // 电子
    case 8:  return (EQPreset){{4,  5,  7,  6,  3,  2,  1,  0, -1, -1}};   // R&B
    case 9:  return (EQPreset){{-3,-2,  0,  2,  5,  8,  6,  3,  0, -1}};   // 人声
    case 10: return (EQPreset){{10, 9,  7,  4,  1,  0, -1, -1, -2, -2}};   // 重低音
    case 11: return (EQPreset){{4,  5,  3,  1,  0,  0,  1,  3,  5,  6}};   // 现场
    default: return (EQPreset){{0,  0,  0,  0,  0,  0,  0,  0,  0,  0}};
  }
}

#pragma mark - iOSEqualizerModule

@interface iOSEqualizerModule ()
@property (nonatomic, weak) AVPlayer *observedPlayer;
@property (nonatomic, assign) BOOL isObserving;
@property (nonatomic, assign) int currentPresetId;
@end

@implementation iOSEqualizerModule

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE(EqualizerModule);

+ (BOOL)requiresMainQueueSetup { return NO; }

- (instancetype)init {
  self = [super init];
  if (self) {
    _currentPresetId = 0;
    if (!sEQCtx) {
      sEQCtx = calloc(1, sizeof(EQProcessorContext));
      sEQCtx->sampleRate = 44100.0f;
      sEQCtx->enabled = NO;
    }
  }
  return self;
}

- (void)dealloc {
  [self stopObservingPlayer];
}

#pragma mark - AVPlayer Discovery

- (AVPlayer *)findAVPlayer {
  @try {
    id module = [self.bridge moduleForName:@"TrackPlayer"];
    if (!module) return nil;

    AVPlayer *player = nil;
    @try { player = [module valueForKeyPath:@"player.avPlayer"]; } @catch(NSException *e) {}
    if (!player) {
      @try { player = [module valueForKeyPath:@"player.wrapper.avPlayer"]; } @catch(NSException *e) {}
    }
    if (player && [player isKindOfClass:[AVPlayer class]]) {
      return player;
    }
  } @catch (NSException *e) {
    RCTLogInfo(@"[EQ] Could not find AVPlayer: %@", e.reason);
  }
  return nil;
}

#pragma mark - KVO on AVPlayer.currentItem

- (void)startObservingPlayer {
  if (self.isObserving) return;

  AVPlayer *player = [self findAVPlayer];
  if (!player) return;

  self.observedPlayer = player;
  [player addObserver:self
           forKeyPath:@"currentItem"
              options:NSKeyValueObservingOptionNew | NSKeyValueObservingOptionInitial
              context:NULL];
  self.isObserving = YES;
  RCTLogInfo(@"[EQ] Started observing AVPlayer.currentItem");
}

- (void)stopObservingPlayer {
  if (self.isObserving && self.observedPlayer) {
    @try {
      [self.observedPlayer removeObserver:self forKeyPath:@"currentItem"];
    } @catch(NSException *e) {}
    self.isObserving = NO;
  }
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary *)change
                       context:(void *)context {
  if ([keyPath isEqualToString:@"currentItem"]) {
    AVPlayerItem *item = change[NSKeyValueChangeNewKey];
    if (item && [item isKindOfClass:[AVPlayerItem class]] && sEQCtx && sEQCtx->enabled) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [self applyTapToItem:item];
      });
    }
  }
}

#pragma mark - Apply Audio Processing Tap

- (void)applyTapToItem:(AVPlayerItem *)item {
  if (!sEQCtx || !sEQCtx->enabled) return;
  if (!item || item.status == AVPlayerItemStatusFailed) return;

  NSArray<AVAssetTrack *> *tracks = [item.asset tracksWithMediaType:AVMediaTypeAudio];
  if (tracks.count == 0) return;

  AVAssetTrack *audioTrack = tracks.firstObject;

  MTAudioProcessingTapCallbacks callbacks;
  callbacks.version = kMTAudioProcessingTapCallbacksVersion_0;
  callbacks.clientInfo = (__bridge void *)self;
  callbacks.init = eqTapInit;
  callbacks.prepare = eqTapPrepare;
  callbacks.process = eqTapProcess;
  callbacks.unprepare = eqTapUnprepare;
  callbacks.finalize = eqTapFinalize;

  MTAudioProcessingTapRef tap;
  OSStatus status = MTAudioProcessingTapCreate(
      kCFAllocatorDefault, &callbacks,
      kMTAudioProcessingTapCreationFlag_PreEffects, &tap);
  if (status != noErr) {
    RCTLogInfo(@"[EQ] Failed to create tap: %d", (int)status);
    return;
  }

  AVMutableAudioMixInputParameters *params =
      [AVMutableAudioMixInputParameters audioMixInputParametersWithTrack:audioTrack];
  params.audioTapProcessor = tap;

  AVMutableAudioMix *audioMix = [AVMutableAudioMix audioMix];
  audioMix.inputParameters = @[params];

  item.audioMix = audioMix;

  CFRelease(tap);
  RCTLogInfo(@"[EQ] Applied EQ tap to player item (preset %d)", self.currentPresetId);
}

- (void)ensureObservingAndApply {
  if (!self.isObserving) {
    [self startObservingPlayer];
  }
  if (self.observedPlayer.currentItem && sEQCtx->enabled) {
    [self applyTapToItem:self.observedPlayer.currentItem];
  }
}

#pragma mark - React Native Bridge Methods

RCT_EXPORT_METHOD(init:(int)sessionId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self startObservingPlayer];

    if (self.currentPresetId > 0 && sEQCtx) {
      sEQCtx->enabled = YES;
      [self ensureObservingAndApply];
    }

    resolve(@{
      @"success": @YES,
      @"sessionId": @(0),
      @"bands": @(EQ_NUM_BANDS),
      @"hasBassBoost": @NO,
      @"hasVirtualizer": @NO,
      @"hasLoudness": @NO,
      @"hasReverb": @NO,
    });
  });
}

RCT_EXPORT_METHOD(applyPreset:(int)presetId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  self.currentPresetId = presetId;

  if (presetId == 0) {
    sEQCtx->enabled = NO;
    dispatch_async(dispatch_get_main_queue(), ^{
      if (self.observedPlayer.currentItem) {
        self.observedPlayer.currentItem.audioMix = nil;
      }
      resolve(@YES);
    });
    return;
  }

  EQPreset preset = getIOSPreset(presetId);
  memcpy(sEQCtx->pendingGains, preset.g, sizeof(float) * EQ_NUM_BANDS);
  sEQCtx->enabled = YES;
  sEQCtx->needsUpdate = YES;

  dispatch_async(dispatch_get_main_queue(), ^{
    [self ensureObservingAndApply];
    resolve(@YES);
  });
}

RCT_EXPORT_METHOD(getInfo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSMutableArray *bands = [NSMutableArray arrayWithCapacity:EQ_NUM_BANDS];
  for (int i = 0; i < EQ_NUM_BANDS; i++) {
    [bands addObject:@{
      @"index": @(i),
      @"centerFreq": @((int)sFreqs[i]),
      @"currentLevel": @((int)(sEQCtx ? sEQCtx->pendingGains[i] * 100 : 0)),
    }];
  }
  resolve(@{
    @"numberOfBands": @(EQ_NUM_BANDS),
    @"minLevel": @(-1200),
    @"maxLevel": @(1200),
    @"bands": bands,
  });
}

RCT_EXPORT_METHOD(release:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (sEQCtx) sEQCtx->enabled = NO;
  [self stopObservingPlayer];
  resolve(@YES);
}

@end
