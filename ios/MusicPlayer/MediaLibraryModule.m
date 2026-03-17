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
 * 将 ipod-library:// URL 导出为本地 m4a 文件（使用 passthrough，不重新编码）
 * 返回本地 file:// URL
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

      // 用 URL 的 hash 生成文件名，避免重复导出
      NSString *hash = [NSString stringWithFormat:@"%lu", (unsigned long)[ipodUrl hash]];
      NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
      NSString *exportDir = [cacheDir stringByAppendingPathComponent:@"exported_audio"];
      NSFileManager *fm = [NSFileManager defaultManager];
      if (![fm fileExistsAtPath:exportDir]) {
        [fm createDirectoryAtPath:exportDir withIntermediateDirectories:YES attributes:nil error:nil];
      }
      NSString *destPath = [exportDir stringByAppendingPathComponent:
                            [NSString stringWithFormat:@"%@.m4a", hash]];

      // 如果已导出过，直接返回
      if ([fm fileExistsAtPath:destPath]) {
        resolve([NSString stringWithFormat:@"file://%@", destPath]);
        return;
      }

      AVURLAsset *asset = [AVURLAsset URLAssetWithURL:sourceURL options:nil];
      AVAssetExportSession *exporter = [AVAssetExportSession exportSessionWithAsset:asset
                                                                         presetName:AVAssetExportPresetPassthrough];
      if (!exporter) {
        reject(@"EXPORT_ERROR", @"Cannot create export session", nil);
        return;
      }

      exporter.outputURL = [NSURL fileURLWithPath:destPath];
      exporter.outputFileType = AVFileTypeAppleM4A;

      [exporter exportAsynchronouslyWithCompletionHandler:^{
        if (exporter.status == AVAssetExportSessionStatusCompleted) {
          resolve([NSString stringWithFormat:@"file://%@", destPath]);
        } else {
          NSString *errMsg = exporter.error.localizedDescription ?: @"Export failed";
          RCTLogWarn(@"[MediaLibrary] Export failed: %@", errMsg);
          // 失败时返回原始 URL 作为兜底
          resolve(ipodUrl);
        }
      }];
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

        NSString *fileName = assetURL.lastPathComponent ?: title;
        NSString *lyrics = [item valueForProperty:MPMediaItemPropertyLyrics];

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
