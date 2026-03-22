#import "TagWriterModule.h"
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>

@implementation TagWriterModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }

#pragma mark - Public Bridge Method

RCT_EXPORT_METHOD(writeMetadata:(NSString *)filePath
                  tags:(NSDictionary *)tags
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSString *ext = filePath.pathExtension.lowercaseString;
    NSError *error = nil;
    BOOL ok = NO;

    if ([ext isEqualToString:@"mp3"]) {
      ok = [self writeID3Tags:filePath tags:tags error:&error];
    } else {
      // M4A / AAC / ALAC / etc → use AVFoundation export
      ok = [self writeAVTags:filePath tags:tags error:&error];
    }

    if (ok) {
      resolve(@YES);
    } else {
      reject(@"TAG_WRITE_ERROR",
             error ? error.localizedDescription : @"Unknown error",
             error);
    }
  });
}

#pragma mark - Write Artwork Bridge

RCT_EXPORT_METHOD(writeArtwork:(NSString *)filePath
                  imagePath:(NSString *)imagePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSData *imgData = [NSData dataWithContentsOfFile:imagePath];
    if (!imgData || imgData.length == 0) {
      reject(@"TAG_WRITE_ERROR", @"Cannot read image file", nil);
      return;
    }

    NSString *ext = filePath.pathExtension.lowercaseString;
    NSError *error = nil;
    BOOL ok = NO;

    if ([ext isEqualToString:@"mp3"]) {
      ok = [self writeID3Artwork:filePath imageData:imgData error:&error];
    } else {
      ok = [self writeAVArtwork:filePath imageData:imgData error:&error];
    }

    if (ok) {
      resolve(@YES);
    } else {
      reject(@"TAG_WRITE_ERROR",
             error ? error.localizedDescription : @"Unknown error",
             error);
    }
  });
}

#pragma mark - AVFoundation Tag Writing (M4A/AAC/ALAC)

- (BOOL)writeAVTags:(NSString *)filePath
               tags:(NSDictionary *)tags
              error:(NSError **)outError
{
  NSURL *srcURL = [NSURL fileURLWithPath:filePath];
  AVAsset *asset = [AVAsset assetWithURL:srcURL];

  if (![asset isExportable]) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:1
                                              userInfo:@{NSLocalizedDescriptionKey: @"Asset not exportable"}];
    return NO;
  }

  AVAssetExportSession *session = [AVAssetExportSession exportSessionWithAsset:asset
                                                                    presetName:AVAssetExportPresetPassthrough];
  if (!session) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:2
                                              userInfo:@{NSLocalizedDescriptionKey: @"Cannot create export session"}];
    return NO;
  }

  // Build metadata items
  NSMutableArray<AVMutableMetadataItem *> *items = [NSMutableArray array];

  if (tags[@"title"]) {
    AVMutableMetadataItem *item = [AVMutableMetadataItem metadataItem];
    item.keySpace = AVMetadataKeySpaceiTunes;
    item.key = AVMetadataiTunesMetadataKeySongName;
    item.value = tags[@"title"];
    [items addObject:item];
  }
  if (tags[@"artist"]) {
    AVMutableMetadataItem *item = [AVMutableMetadataItem metadataItem];
    item.keySpace = AVMetadataKeySpaceiTunes;
    item.key = AVMetadataiTunesMetadataKeyArtist;
    item.value = tags[@"artist"];
    [items addObject:item];
  }
  if (tags[@"album"]) {
    AVMutableMetadataItem *item = [AVMutableMetadataItem metadataItem];
    item.keySpace = AVMetadataKeySpaceiTunes;
    item.key = AVMetadataiTunesMetadataKeyAlbum;
    item.value = tags[@"album"];
    [items addObject:item];
  }

  session.metadata = items;

  // Export to temp file then replace original
  NSString *tmpPath = [filePath stringByAppendingString:@".tmp"];
  NSURL *tmpURL = [NSURL fileURLWithPath:tmpPath];
  [[NSFileManager defaultManager] removeItemAtURL:tmpURL error:nil];

  session.outputURL = tmpURL;
  session.outputFileType = AVFileTypeAppleM4A;

  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  __block BOOL exportOk = NO;
  __block NSError *exportErr = nil;

  [session exportAsynchronouslyWithCompletionHandler:^{
    if (session.status == AVAssetExportSessionStatusCompleted) {
      exportOk = YES;
    } else {
      exportErr = session.error;
    }
    dispatch_semaphore_signal(sema);
  }];

  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);

  if (!exportOk) {
    [[NSFileManager defaultManager] removeItemAtPath:tmpPath error:nil];
    if (outError) *outError = exportErr ?: [NSError errorWithDomain:@"TagWriter" code:3
                                                           userInfo:@{NSLocalizedDescriptionKey: @"Export failed"}];
    return NO;
  }

  // Replace original with tagged version
  NSError *replaceErr = nil;
  [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
  if (![[NSFileManager defaultManager] moveItemAtPath:tmpPath toPath:filePath error:&replaceErr]) {
    if (outError) *outError = replaceErr;
    return NO;
  }

  return YES;
}

#pragma mark - ID3v2 Tag Writing (MP3)

- (BOOL)writeID3Tags:(NSString *)filePath
                tags:(NSDictionary *)tags
               error:(NSError **)outError
{
  NSMutableData *fileData = [NSMutableData dataWithContentsOfFile:filePath];
  if (!fileData || fileData.length < 10) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:10
                                              userInfo:@{NSLocalizedDescriptionKey: @"Cannot read file"}];
    return NO;
  }

  const uint8_t *bytes = (const uint8_t *)fileData.bytes;

  // Check for existing ID3v2 header
  NSUInteger oldTagSize = 0;
  NSUInteger audioStart = 0;
  if (bytes[0] == 'I' && bytes[1] == 'D' && bytes[2] == '3') {
    // Existing ID3v2 tag: parse size (syncsafe integer)
    oldTagSize = 10 +
      (((NSUInteger)bytes[6] << 21) |
       ((NSUInteger)bytes[7] << 14) |
       ((NSUInteger)bytes[8] << 7)  |
       ((NSUInteger)bytes[9]));
    audioStart = oldTagSize;
  }

  // Read existing ID3v2 frames to preserve ones we're not modifying
  NSMutableDictionary *existingFrames = [NSMutableDictionary dictionary];
  if (oldTagSize > 10) {
    NSUInteger pos = 10;
    while (pos + 10 < oldTagSize) {
      const uint8_t *fb = bytes + pos;
      NSString *frameId = [[NSString alloc] initWithBytes:fb length:4 encoding:NSASCIIStringEncoding];
      if (!frameId || [frameId characterAtIndex:0] == 0) break;
      uint32_t fsize = ((uint32_t)fb[4] << 24) | ((uint32_t)fb[5] << 16) |
                       ((uint32_t)fb[6] << 8)  | ((uint32_t)fb[7]);
      if (fsize == 0 || pos + 10 + fsize > oldTagSize) break;
      NSData *framePayload = [NSData dataWithBytes:fb + 10 length:fsize];
      existingFrames[frameId] = framePayload;
      pos += 10 + fsize;
    }
  }

  // Override frames with new values
  NSDictionary *fieldToFrame = @{@"title": @"TIT2", @"artist": @"TPE1", @"album": @"TALB"};
  for (NSString *field in fieldToFrame) {
    NSString *val = tags[field];
    if (val) {
      NSString *frameId = fieldToFrame[field];
      // ID3v2.3 text frame: 1 byte encoding (0x03 = UTF-8) + UTF-8 string
      NSData *strData = [val dataUsingEncoding:NSUTF8StringEncoding];
      NSMutableData *payload = [NSMutableData dataWithCapacity:1 + strData.length];
      uint8_t enc = 0x03; // UTF-8
      [payload appendBytes:&enc length:1];
      [payload appendData:strData];
      existingFrames[frameId] = payload;
    }
  }

  // Build new ID3v2.3 tag
  NSMutableData *framesData = [NSMutableData data];
  for (NSString *fid in existingFrames) {
    NSData *payload = existingFrames[fid];
    const char *fidCStr = [fid UTF8String];
    [framesData appendBytes:fidCStr length:4];
    uint32_t sz = (uint32_t)payload.length;
    uint8_t sizeBytes[4] = { (uint8_t)(sz >> 24), (uint8_t)(sz >> 16), (uint8_t)(sz >> 8), (uint8_t)sz };
    [framesData appendBytes:sizeBytes length:4];
    uint8_t flags[2] = {0, 0};
    [framesData appendBytes:flags length:2];
    [framesData appendData:payload];
  }

  // ID3v2.3 header
  uint32_t tagBodySize = (uint32_t)framesData.length;
  uint8_t header[10] = {
    'I', 'D', '3',
    0x03, 0x00,  // version 2.3
    0x00,        // flags
    (uint8_t)((tagBodySize >> 21) & 0x7F),
    (uint8_t)((tagBodySize >> 14) & 0x7F),
    (uint8_t)((tagBodySize >> 7) & 0x7F),
    (uint8_t)(tagBodySize & 0x7F),
  };

  // Assemble: new header + frames + audio data
  NSMutableData *finalData = [NSMutableData dataWithCapacity:10 + tagBodySize + (fileData.length - audioStart)];
  [finalData appendBytes:header length:10];
  [finalData appendData:framesData];
  [finalData appendBytes:(bytes + audioStart) length:(fileData.length - audioStart)];

  if (![finalData writeToFile:filePath atomically:YES]) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:11
                                              userInfo:@{NSLocalizedDescriptionKey: @"Failed to write file"}];
    return NO;
  }

  return YES;
}

#pragma mark - ID3v2 Artwork Writing (MP3 APIC frame)

- (BOOL)writeID3Artwork:(NSString *)filePath
              imageData:(NSData *)imgData
                  error:(NSError **)outError
{
  NSMutableData *fileData = [NSMutableData dataWithContentsOfFile:filePath];
  if (!fileData || fileData.length < 10) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:10
                                              userInfo:@{NSLocalizedDescriptionKey: @"Cannot read file"}];
    return NO;
  }

  const uint8_t *bytes = (const uint8_t *)fileData.bytes;

  NSUInteger oldTagSize = 0;
  NSUInteger audioStart = 0;
  if (bytes[0] == 'I' && bytes[1] == 'D' && bytes[2] == '3') {
    oldTagSize = 10 +
      (((NSUInteger)bytes[6] << 21) |
       ((NSUInteger)bytes[7] << 14) |
       ((NSUInteger)bytes[8] << 7)  |
       ((NSUInteger)bytes[9]));
    audioStart = oldTagSize;
  }

  // Read existing frames
  NSMutableDictionary *existingFrames = [NSMutableDictionary dictionary];
  if (oldTagSize > 10) {
    NSUInteger pos = 10;
    while (pos + 10 < oldTagSize) {
      const uint8_t *fb = bytes + pos;
      NSString *frameId = [[NSString alloc] initWithBytes:fb length:4 encoding:NSASCIIStringEncoding];
      if (!frameId || [frameId characterAtIndex:0] == 0) break;
      uint32_t fsize = ((uint32_t)fb[4] << 24) | ((uint32_t)fb[5] << 16) |
                       ((uint32_t)fb[6] << 8)  | ((uint32_t)fb[7]);
      if (fsize == 0 || pos + 10 + fsize > oldTagSize) break;
      NSData *framePayload = [NSData dataWithBytes:fb + 10 length:fsize];
      existingFrames[frameId] = framePayload;
      pos += 10 + fsize;
    }
  }

  // Build APIC frame payload: encoding(1) + mime(null-terminated) + picType(1) + desc(null-terminated) + data
  NSMutableData *apicPayload = [NSMutableData data];
  uint8_t encoding = 0x00; // ISO-8859-1
  [apicPayload appendBytes:&encoding length:1];
  const char *mimeStr = "image/jpeg";
  [apicPayload appendBytes:mimeStr length:strlen(mimeStr) + 1]; // include null terminator
  uint8_t picType = 0x03; // Cover (front)
  [apicPayload appendBytes:&picType length:1];
  uint8_t descNull = 0x00;
  [apicPayload appendBytes:&descNull length:1]; // empty description
  [apicPayload appendData:imgData];

  existingFrames[@"APIC"] = apicPayload;

  // Rebuild tag
  NSMutableData *framesData = [NSMutableData data];
  for (NSString *fid in existingFrames) {
    NSData *payload = existingFrames[fid];
    const char *fidCStr = [fid UTF8String];
    [framesData appendBytes:fidCStr length:4];
    uint32_t sz = (uint32_t)payload.length;
    uint8_t sizeBytes[4] = { (uint8_t)(sz >> 24), (uint8_t)(sz >> 16), (uint8_t)(sz >> 8), (uint8_t)sz };
    [framesData appendBytes:sizeBytes length:4];
    uint8_t flags[2] = {0, 0};
    [framesData appendBytes:flags length:2];
    [framesData appendData:payload];
  }

  uint32_t tagBodySize = (uint32_t)framesData.length;
  uint8_t header[10] = {
    'I', 'D', '3',
    0x03, 0x00,
    0x00,
    (uint8_t)((tagBodySize >> 21) & 0x7F),
    (uint8_t)((tagBodySize >> 14) & 0x7F),
    (uint8_t)((tagBodySize >> 7) & 0x7F),
    (uint8_t)(tagBodySize & 0x7F),
  };

  NSMutableData *finalData = [NSMutableData dataWithCapacity:10 + tagBodySize + (fileData.length - audioStart)];
  [finalData appendBytes:header length:10];
  [finalData appendData:framesData];
  [finalData appendBytes:(bytes + audioStart) length:(fileData.length - audioStart)];

  if (![finalData writeToFile:filePath atomically:YES]) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:11
                                              userInfo:@{NSLocalizedDescriptionKey: @"Failed to write file"}];
    return NO;
  }
  return YES;
}

#pragma mark - AVFoundation Artwork Writing (M4A/AAC)

- (BOOL)writeAVArtwork:(NSString *)filePath
             imageData:(NSData *)imgData
                 error:(NSError **)outError
{
  NSURL *srcURL = [NSURL fileURLWithPath:filePath];
  AVAsset *asset = [AVAsset assetWithURL:srcURL];

  if (![asset isExportable]) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:1
                                              userInfo:@{NSLocalizedDescriptionKey: @"Asset not exportable"}];
    return NO;
  }

  AVAssetExportSession *session = [AVAssetExportSession exportSessionWithAsset:asset
                                                                    presetName:AVAssetExportPresetPassthrough];
  if (!session) {
    if (outError) *outError = [NSError errorWithDomain:@"TagWriter" code:2
                                              userInfo:@{NSLocalizedDescriptionKey: @"Cannot create export session"}];
    return NO;
  }

  AVMutableMetadataItem *artItem = [AVMutableMetadataItem metadataItem];
  artItem.keySpace = AVMetadataKeySpaceiTunes;
  artItem.key = AVMetadataiTunesMetadataKeyCoverArt;
  artItem.value = imgData;
  artItem.dataType = (__bridge NSString *)kCMMetadataBaseDataType_JPEG;

  session.metadata = @[artItem];

  NSString *tmpPath = [filePath stringByAppendingString:@".tmp"];
  NSURL *tmpURL = [NSURL fileURLWithPath:tmpPath];
  [[NSFileManager defaultManager] removeItemAtURL:tmpURL error:nil];

  session.outputURL = tmpURL;
  session.outputFileType = AVFileTypeAppleM4A;

  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  __block BOOL exportOk = NO;
  __block NSError *exportErr = nil;

  [session exportAsynchronouslyWithCompletionHandler:^{
    if (session.status == AVAssetExportSessionStatusCompleted) {
      exportOk = YES;
    } else {
      exportErr = session.error;
    }
    dispatch_semaphore_signal(sema);
  }];

  dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);

  if (!exportOk) {
    [[NSFileManager defaultManager] removeItemAtPath:tmpPath error:nil];
    if (outError) *outError = exportErr ?: [NSError errorWithDomain:@"TagWriter" code:3
                                                           userInfo:@{NSLocalizedDescriptionKey: @"Export failed"}];
    return NO;
  }

  NSError *replaceErr = nil;
  [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
  if (![[NSFileManager defaultManager] moveItemAtPath:tmpPath toPath:filePath error:&replaceErr]) {
    if (outError) *outError = replaceErr;
    return NO;
  }

  return YES;
}

@end
