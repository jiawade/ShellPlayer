#import "MediaLibraryModule.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>
#import <React/RCTLog.h>

@implementation MediaLibraryModule

RCT_EXPORT_MODULE();

+ (BOOL)isSimulator
{
#if TARGET_OS_SIMULATOR
  return YES;
#else
  return NO;
#endif
}

RCT_EXPORT_METHOD(isSimulator:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve(@([MediaLibraryModule isSimulator]));
}

/**
 * 请求 Apple Music / 媒体库访问权限
 */
RCT_EXPORT_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (@available(iOS 9.3, *)) {
    MPMediaLibraryAuthorizationStatus status = [MPMediaLibrary authorizationStatus];
    if (status == MPMediaLibraryAuthorizationStatusAuthorized) {
      resolve(@(YES));
      return;
    }
    if (status == MPMediaLibraryAuthorizationStatusDenied ||
        status == MPMediaLibraryAuthorizationStatusRestricted) {
      resolve(@(NO));
      return;
    }
    [MPMediaLibrary requestAuthorization:^(MPMediaLibraryAuthorizationStatus newStatus) {
      resolve(@(newStatus == MPMediaLibraryAuthorizationStatusAuthorized));
    }];
  } else {
    resolve(@(YES));
  }
}

/**
 * 检查当前权限状态
 */
RCT_EXPORT_METHOD(getPermissionStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (@available(iOS 9.3, *)) {
    MPMediaLibraryAuthorizationStatus status = [MPMediaLibrary authorizationStatus];
    switch (status) {
      case MPMediaLibraryAuthorizationStatusAuthorized:
        resolve(@"authorized");
        break;
      case MPMediaLibraryAuthorizationStatusDenied:
        resolve(@"denied");
        break;
      case MPMediaLibraryAuthorizationStatusRestricted:
        resolve(@"restricted");
        break;
      default:
        resolve(@"notDetermined");
        break;
    }
  } else {
    resolve(@"authorized");
  }
}

/**
 * 用指定 preset + outputFileType 尝试导出，同步等待结果
 * 返回 YES 表示成功，NO 表示失败
 */
- (BOOL)tryExportAsset:(AVURLAsset *)asset
                toPath:(NSString *)destPath
                preset:(NSString *)preset
            fileType:(AVFileType)fileType
{
  NSFileManager *fm = [NSFileManager defaultManager];
  // 清除之前可能残留的失败文件
  if ([fm fileExistsAtPath:destPath]) {
    [fm removeItemAtPath:destPath error:nil];
  }

  AVAssetExportSession *exporter =
    [AVAssetExportSession exportSessionWithAsset:asset presetName:preset];
  if (!exporter) return NO;

  exporter.outputURL = [NSURL fileURLWithPath:destPath];
  exporter.outputFileType = fileType;

  dispatch_semaphore_t sem = dispatch_semaphore_create(0);
  __block BOOL success = NO;

  [exporter exportAsynchronouslyWithCompletionHandler:^{
    success = (exporter.status == AVAssetExportSessionStatusCompleted);
    dispatch_semaphore_signal(sem);
  }];
  dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC));

  if (!success && [fm fileExistsAtPath:destPath]) {
    [fm removeItemAtPath:destPath error:nil];
  }
  return success;
}

/**
 * 将 ipod-library:// URL 导出为本地音频文件
 * 依次尝试：passthrough→M4A, passthrough→MP4, 重编码→M4A
 */
RCT_EXPORT_METHOD(exportToFile:(NSString *)ipodUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      NSURL *sourceURL = [NSURL URLWithString:ipodUrl];
      if (!sourceURL) {
        reject(@"EXPORT_ERROR", @"Invalid URL", nil);
        return;
      }

      NSString *hash = [NSString stringWithFormat:@"%lu", (unsigned long)[ipodUrl hash]];
      NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
      NSString *exportDir = [cacheDir stringByAppendingPathComponent:@"exported_audio"];
      NSFileManager *fm = [NSFileManager defaultManager];
      if (![fm fileExistsAtPath:exportDir]) {
        [fm createDirectoryAtPath:exportDir withIntermediateDirectories:YES attributes:nil error:nil];
      }

      // 检查各种可能的缓存文件
      NSArray *extensions = @[@"m4a", @"mp4", @"caf"];
      for (NSString *ext in extensions) {
        NSString *cached = [exportDir stringByAppendingPathComponent:
                            [NSString stringWithFormat:@"%@.%@", hash, ext]];
        if ([fm fileExistsAtPath:cached]) {
          resolve([NSString stringWithFormat:@"file://%@", cached]);
          return;
        }
      }

      AVURLAsset *asset = [AVURLAsset URLAssetWithURL:sourceURL options:nil];

      // 策略1: passthrough → M4A（最快，AAC/ALAC 音源适用）
      NSString *pathM4A = [exportDir stringByAppendingPathComponent:
                           [NSString stringWithFormat:@"%@.m4a", hash]];
      if ([self tryExportAsset:asset toPath:pathM4A
                        preset:AVAssetExportPresetPassthrough fileType:AVFileTypeAppleM4A]) {
        resolve([NSString stringWithFormat:@"file://%@", pathM4A]);
        return;
      }

      // 策略2: passthrough → MPEG4（MP3 等格式可放入 MP4 容器）
      NSString *pathMP4 = [exportDir stringByAppendingPathComponent:
                           [NSString stringWithFormat:@"%@.mp4", hash]];
      if ([self tryExportAsset:asset toPath:pathMP4
                        preset:AVAssetExportPresetPassthrough fileType:AVFileTypeMPEG4]) {
        resolve([NSString stringWithFormat:@"file://%@", pathMP4]);
        return;
      }

      // 策略3: passthrough → CAF（Apple 通用音频容器，接受任何编解码器）
      NSString *pathCAF = [exportDir stringByAppendingPathComponent:
                           [NSString stringWithFormat:@"%@.caf", hash]];
      if ([self tryExportAsset:asset toPath:pathCAF
                        preset:AVAssetExportPresetPassthrough fileType:AVFileTypeCoreAudioFormat]) {
        resolve([NSString stringWithFormat:@"file://%@", pathCAF]);
        return;
      }

      // 策略4: 重新编码为 AAC M4A（最慢但兼容性最好）
      if ([self tryExportAsset:asset toPath:pathM4A
                        preset:AVAssetExportPresetAppleM4A fileType:AVFileTypeAppleM4A]) {
        resolve([NSString stringWithFormat:@"file://%@", pathM4A]);
        return;
      }

      RCTLogInfo(@"[MediaLibrary] All export strategies failed for: %@", ipodUrl);
      reject(@"EXPORT_ERROR", @"Cannot export audio file", nil);
    } @catch (NSException *exception) {
      reject(@"EXPORT_ERROR", exception.reason, nil);
    }
  });
}

/**
 * 从 AVURLAsset 中读取歌词元数据（支持 M4A/MP3 的 ©lyr / USLT 标签）
 */
RCT_EXPORT_METHOD(getLyricsForUrl:(NSString *)urlString
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      NSURL *url = [NSURL URLWithString:urlString];
      if (!url) { resolve([NSNull null]); return; }

      AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
      NSString *lyrics = nil;

      // 1. iTunes metadata (M4A ©lyr)
      NSArray *iTunesMeta = [asset metadataForFormat:AVMetadataFormatiTunesMetadata];
      for (AVMetadataItem *item in iTunesMeta) {
        if ([item.commonKey isEqualToString:AVMetadataCommonKeyDescription] ||
            (item.identifier && [item.identifier localizedCaseInsensitiveContainsString:@"lyrics"])) {
          NSString *val = [item stringValue];
          if (val && val.length > 0) { lyrics = val; break; }
        }
      }

      // 2. ID3 metadata (MP3 USLT)
      if (!lyrics || lyrics.length == 0) {
        NSArray *id3Meta = [asset metadataForFormat:AVMetadataFormatID3Metadata];
        for (AVMetadataItem *item in id3Meta) {
          if ((item.identifier && [item.identifier localizedCaseInsensitiveContainsString:@"USLT"]) ||
              [item.commonKey isEqualToString:AVMetadataCommonKeyDescription]) {
            NSString *val = [item stringValue];
            if (val && val.length > 0) { lyrics = val; break; }
          }
        }
      }

      // 3. Common metadata fallback
      if (!lyrics || lyrics.length == 0) {
        NSArray *commonMeta = [asset commonMetadata];
        for (AVMetadataItem *item in commonMeta) {
          if ([item.commonKey isEqualToString:AVMetadataCommonKeyDescription]) {
            NSString *val = [item stringValue];
            if (val && val.length > 0) { lyrics = val; break; }
          }
        }
      }

      resolve(lyrics ?: [NSNull null]);
    } @catch (NSException *exception) {
      resolve([NSNull null]);
    }
  });
}

/**
 * 获取 iTunes/iPod 音乐库中的所有歌曲
 */
RCT_EXPORT_METHOD(getAllSongs:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      MPMediaQuery *query = [MPMediaQuery songsQuery];
      MPMediaPropertyPredicate *isCloudPred =
        [MPMediaPropertyPredicate predicateWithValue:@(NO)
                                         forProperty:MPMediaItemPropertyIsCloudItem];
      [query addFilterPredicate:isCloudPred];

      NSArray<MPMediaItem *> *items = query.items;
      if (!items) {
        RCTLogInfo(@"[MediaLibrary] No items returned from query");
        resolve(@[]);
        return;
      }

      RCTLogInfo(@"[MediaLibrary] Found %lu items in library", (unsigned long)items.count);
      NSMutableArray *results = [NSMutableArray arrayWithCapacity:items.count];

      for (MPMediaItem *item in items) {
        NSNumber *persistentID = [item valueForProperty:MPMediaItemPropertyPersistentID];
        NSURL *assetURL = [item valueForProperty:MPMediaItemPropertyAssetURL];

        if (!assetURL) continue;

        NSString *title = [item valueForProperty:MPMediaItemPropertyTitle] ?: @"未知歌曲";
        NSString *artist = [item valueForProperty:MPMediaItemPropertyArtist] ?: @"未知歌手";
        NSString *album = [item valueForProperty:MPMediaItemPropertyAlbumTitle] ?: @"未知专辑";
        NSNumber *duration = [item valueForProperty:MPMediaItemPropertyPlaybackDuration] ?: @(0);

        NSString *trackId = [NSString stringWithFormat:@"ipod://%@", persistentID];

        // 获取封面并保存到缓存
        NSString *artworkUri = nil;
        MPMediaItemArtwork *artworkObj = [item valueForProperty:MPMediaItemPropertyArtwork];
        if (artworkObj) {
          UIImage *image = [artworkObj imageWithSize:CGSizeMake(300, 300)];
          if (image) {
            NSData *jpegData = UIImageJPEGRepresentation(image, 0.7);
            if (jpegData) {
              NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
              NSString *artworkDir = [cacheDir stringByAppendingPathComponent:@"artwork"];

              NSFileManager *fm = [NSFileManager defaultManager];
              if (![fm fileExistsAtPath:artworkDir]) {
                [fm createDirectoryAtPath:artworkDir withIntermediateDirectories:YES attributes:nil error:nil];
              }

              NSString *artFile = [artworkDir stringByAppendingPathComponent:
                                   [NSString stringWithFormat:@"%@.jpg", persistentID]];
              if (![fm fileExistsAtPath:artFile]) {
                [jpegData writeToFile:artFile atomically:YES];
              }
              artworkUri = [NSString stringWithFormat:@"file://%@", artFile];
            }
          }
        }

        NSString *rawFileName = assetURL.lastPathComponent ?: @"";
        // iPod library URLs return generic names like "item.mp3"; use title instead
        NSString *fileName;
        if ([rawFileName isEqualToString:@""] || [rawFileName hasPrefix:@"item."]) {
          // Build a meaningful fileName from the title + original extension
          NSString *ext = [rawFileName pathExtension];
          if (ext.length == 0) ext = @"m4a";
          fileName = [NSString stringWithFormat:@"%@.%@", title, ext];
        } else {
          fileName = rawFileName;
        }
        NSString *lyrics = [item valueForProperty:MPMediaItemPropertyLyrics];
        NSString *genre = [item valueForProperty:MPMediaItemPropertyGenre];
        NSString *composer = [item valueForProperty:MPMediaItemPropertyComposer];
        NSDate *releaseDate = [item valueForProperty:MPMediaItemPropertyReleaseDate];
        NSString *year = nil;
        if (releaseDate) {
          NSCalendar *cal = [NSCalendar currentCalendar];
          NSInteger y = [cal component:NSCalendarUnitYear fromDate:releaseDate];
          if (y > 0) year = [@(y) stringValue];
        }
        NSNumber *trackNum = [item valueForProperty:MPMediaItemPropertyAlbumTrackNumber];
        NSString *comments = [item valueForProperty:MPMediaItemPropertyComments];

        NSMutableDictionary *track = [NSMutableDictionary dictionaryWithDictionary:@{
          @"id": trackId,
          @"url": assetURL.absoluteString,
          @"title": title,
          @"artist": artist,
          @"album": album,
          @"duration": duration,
          @"fileName": fileName,
          @"filePath": assetURL.absoluteString,
        }];

        if (artworkUri) {
          track[@"artwork"] = artworkUri;
        }
        if (lyrics && lyrics.length > 0) {
          track[@"lyrics"] = lyrics;
        }
        if (genre && genre.length > 0) {
          track[@"genre"] = genre;
        }
        if (composer && composer.length > 0) {
          track[@"composer"] = composer;
        }
        if (year) {
          track[@"year"] = year;
        }
        if (trackNum && trackNum.integerValue > 0) {
          track[@"trackNumber"] = [trackNum stringValue];
        }
        if (comments && comments.length > 0) {
          track[@"comment"] = comments;
        }

        [results addObject:track];
      }

      RCTLogInfo(@"[MediaLibrary] Returning %lu playable tracks", (unsigned long)results.count);
      resolve(results);
    } @catch (NSException *exception) {
      reject(@"MEDIA_LIBRARY_ERROR", exception.reason, nil);
    }
  });
}

@end
