#import "AudioLevelModule.h"
#import <React/RCTBridge.h>
#import <React/RCTLog.h>
#import <math.h>

// Shared metering context (written from EQ tap, read by timer)

#define METER_NUM_BANDS 16

typedef struct {
  float bandLevels[METER_NUM_BANDS];
  float overallLevel;
  volatile BOOL hasData;
} AudioMeterContext;

static AudioMeterContext sMeterCtx = {0};

// Bandpass helpers

static void computeBandLevels(const float *samples, UInt32 count, UInt32 channels, BOOL nonInterleaved, float sampleRate) {
  if (count == 0 || channels == 0) return;

  float sumSq = 0;
  UInt32 total = nonInterleaved ? count : count / channels;

  if (nonInterleaved) {
    for (UInt32 i = 0; i < total; i++) {
      float s = samples[i];
      sumSq += s * s;
    }
  } else {
    for (UInt32 i = 0; i < total; i++) {
      float s = samples[i * channels];
      sumSq += s * s;
    }
  }

  float rms = sqrtf(sumSq / (float)total);
  float level = fminf(1.0f, rms * 3.5f);
  sMeterCtx.overallLevel = level;

  for (int b = 0; b < METER_NUM_BANDS; b++) {
    UInt32 bandStart = (UInt32)((float)b / METER_NUM_BANDS * total);
    UInt32 bandEnd   = (UInt32)((float)(b + 1) / METER_NUM_BANDS * total);
    if (bandEnd > total) bandEnd = total;
    if (bandEnd <= bandStart) bandEnd = bandStart + 1;

    float bSumSq = 0;
    if (nonInterleaved) {
      for (UInt32 i = bandStart; i < bandEnd && i < count; i++) {
        float s = samples[i];
        bSumSq += s * s;
      }
    } else {
      for (UInt32 i = bandStart; i < bandEnd; i++) {
        UInt32 idx = i * channels;
        if (idx < count) {
          float s = samples[idx];
          bSumSq += s * s;
        }
      }
    }
    float bRms = sqrtf(bSumSq / (float)(bandEnd - bandStart));
    sMeterCtx.bandLevels[b] = fminf(1.0f, bRms * 3.5f);
  }

  sMeterCtx.hasData = YES;
}

// Public C function called from EQ tap

void AudioMeter_ProcessSamples(const float *samples, UInt32 sampleCount, UInt32 channels, BOOL nonInterleaved, float sampleRate) {
  computeBandLevels(samples, sampleCount, channels, nonInterleaved, sampleRate);
}

// Module implementation (timer-only, no tap management)

@interface AudioLevelModule ()
@property (nonatomic, strong) NSTimer *emitTimer;
@property (nonatomic, assign) BOOL isMonitoring;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, assign) BOOL wasPausedByBackground;
@end

@implementation AudioLevelModule

@synthesize bridge = _bridge;

RCT_EXPORT_MODULE(AudioLevelModule);

+ (BOOL)requiresMainQueueSetup { return NO; }

- (instancetype)init {
  self = [super init];
  if (self) {
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(appDidEnterBackground)
                                                 name:UIApplicationDidEnterBackgroundNotification
                                               object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(appWillEnterForeground)
                                                 name:UIApplicationWillEnterForegroundNotification
                                               object:nil];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onAudioLevels"];
}

- (void)startObserving { self.hasListeners = YES; }
- (void)stopObserving  { self.hasListeners = NO; }

#pragma mark - Timer & Emit

- (void)startEmitting {
  if (self.emitTimer) return;
  self.emitTimer = [NSTimer scheduledTimerWithTimeInterval:0.05
                                                    target:self
                                                  selector:@selector(emitLevels)
                                                  userInfo:nil
                                                   repeats:YES];
}

- (void)stopEmitting {
  [self.emitTimer invalidate];
  self.emitTimer = nil;
}

- (void)emitLevels {
  if (!self.hasListeners) return;
  if (!sMeterCtx.hasData) return;

  NSMutableArray *bands = [NSMutableArray arrayWithCapacity:METER_NUM_BANDS];
  for (int i = 0; i < METER_NUM_BANDS; i++) {
    [bands addObject:@(sMeterCtx.bandLevels[i])];
  }
  [self sendEventWithName:@"onAudioLevels" body:@{
    @"levels": bands,
    @"overall": @(sMeterCtx.overallLevel),
  }];
}

#pragma mark - JS API

RCT_EXPORT_METHOD(startMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    self.isMonitoring = YES;
    [self startEmitting];
    RCTLogInfo(@"[AudioMeter] Started emitting (tap managed by EQ module)");
    resolve(@YES);
  });
}

RCT_EXPORT_METHOD(stopMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    self.isMonitoring = NO;
    [self stopEmitting];
    memset(&sMeterCtx, 0, sizeof(AudioMeterContext));
    resolve(@YES);
  });
}

- (void)dealloc {
  [self stopEmitting];
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

#pragma mark - App Lifecycle

- (void)appDidEnterBackground {
  if (self.isMonitoring && self.emitTimer) {
    self.wasPausedByBackground = YES;
    [self stopEmitting];
  }
}

- (void)appWillEnterForeground {
  if (self.wasPausedByBackground && self.isMonitoring) {
    self.wasPausedByBackground = NO;
    dispatch_async(dispatch_get_main_queue(), ^{
      [self startEmitting];
    });
  }
}

@end
