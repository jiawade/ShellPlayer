#import "MediaLibraryModule.h"
#import <MediaPlayer/MediaPlayer.h>
#import <React/RCTLog.h>

@implementation MediaLibraryModule

RCT_EXPORT_MODULE();

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
    // iOS < 9.3: no authorization needed
    resolve(@(YES));
  }
}

/**
 * 检查当前权限状态
 * 返回: "authorized" | "denied" | "restricted" | "notDetermined"
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
 * 获取 iTunes/iPod 音乐库中的所有歌曲
 * 返回歌曲数组，每首歌包含: id, url, title, artist, album, artwork, duration, fileName
 */
RCT_EXPORT_METHOD(getAllSongs:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      MPMediaQuery *query = [MPMediaQuery songsQuery];
      // 只要本地可播放的音频文件（排除 Apple Music 云端歌曲）
      MPMediaPropertyPredicate *isCloudPred =
        [MPMediaPropertyPredicate predicateWithValue:@(NO)
                                         forProperty:MPMediaItemPropertyIsCloudItem];
      [query addFilterPredicate:isCloudPred];

      NSArray<MPMediaItem *> *items = query.items;
      if (!items) {
        resolve(@[]);
        return;
      }

      NSMutableArray *results = [NSMutableArray arrayWithCapacity:items.count];

      for (MPMediaItem *item in items) {
        NSNumber *persistentID = [item valueForProperty:MPMediaItemPropertyPersistentID];
        NSURL *assetURL = [item valueForProperty:MPMediaItemPropertyAssetURL];

        if (!assetURL) continue; // 跳过无法播放的项目（DRM protected 等）

        NSString *title = [item valueForProperty:MPMediaItemPropertyTitle] ?: @"未知歌曲";
        NSString *artist = [item valueForProperty:MPMediaItemPropertyArtist] ?: @"未知歌手";
        NSString *album = [item valueForProperty:MPMediaItemPropertyAlbumTitle] ?: @"未知专辑";
        NSNumber *duration = [item valueForProperty:MPMediaItemPropertyPlaybackDuration] ?: @(0);

        // 生成唯一 ID
        NSString *trackId = [NSString stringWithFormat:@"ipod://%@", persistentID];

        // 尝试获取封面
        NSString *artworkUri = [NSNull null];
        MPMediaItemArtwork *artworkObj = [item valueForProperty:MPMediaItemPropertyArtwork];
        if (artworkObj) {
          UIImage *image = [artworkObj imageWithSize:CGSizeMake(300, 300)];
          if (image) {
            NSData *jpegData = UIImageJPEGRepresentation(image, 0.7);
            if (jpegData) {
              // 保存到缓存目录
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

        // 文件名（从 URL path 取出）
        NSString *fileName = assetURL.lastPathComponent ?: title;

        NSDictionary *track = @{
          @"id": trackId,
          @"url": assetURL.absoluteString,
          @"title": title,
          @"artist": artist,
          @"album": album,
          @"artwork": artworkUri == (id)[NSNull null] ? [NSNull null] : artworkUri,
          @"duration": duration,
          @"fileName": fileName,
          @"filePath": assetURL.absoluteString,
        };

        [results addObject:track];
      }

      resolve(results);
    } @catch (NSException *exception) {
      reject(@"MEDIA_LIBRARY_ERROR", exception.reason, nil);
    }
  });
}

@end
