#import "RingtoneModule.h"
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>

@implementation RingtoneModule

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setAsRingtone:(NSString *)filePath
                  title:(NSString *)title
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // iOS does not allow setting system ringtones/alarms programmatically.
  // We open the GarageBand export flow hint or share the file.
  NSURL *fileURL = [NSURL fileURLWithPath:filePath];
  if (![[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
    reject(@"FILE_NOT_FOUND", @"File not found", nil);
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *rootVC = [UIApplication sharedApplication].delegate.window.rootViewController;
    while (rootVC.presentedViewController) {
      rootVC = rootVC.presentedViewController;
    }

    UIActivityViewController *activityVC =
        [[UIActivityViewController alloc] initWithActivityItems:@[fileURL]
                                         applicationActivities:nil];
    activityVC.excludedActivityTypes = @[
      UIActivityTypePostToFacebook,
      UIActivityTypePostToTwitter,
      UIActivityTypePostToWeibo,
    ];

    if ([activityVC respondsToSelector:@selector(popoverPresentationController)]) {
      activityVC.popoverPresentationController.sourceView = rootVC.view;
      activityVC.popoverPresentationController.sourceRect = CGRectMake(
        rootVC.view.bounds.size.width / 2, rootVC.view.bounds.size.height / 2, 0, 0);
    }

    [rootVC presentViewController:activityVC animated:YES completion:nil];
    resolve(@(YES));
  });
}

@end
