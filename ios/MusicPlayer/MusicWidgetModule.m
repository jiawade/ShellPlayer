#import "MusicWidgetModule.h"
#import "MusicPlayer-Swift.h"
#import <UIKit/UIKit.h>

// C callback for Darwin notification from widget extension
static void widgetCommandCallback(CFNotificationCenterRef center,
                                  void *observer,
                                  CFNotificationName name,
                                  const void *object,
                                  CFDictionaryRef userInfo)
{
  MusicWidgetModule *module = (__bridge MusicWidgetModule *)observer;
  [module deliverWidgetCommand];
}

@implementation MusicWidgetModule
{
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    // Register for Darwin notification from widget extension
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      (__bridge const void *)self,
      widgetCommandCallback,
      CFSTR("com.musicplayer.widgetCommand"),
      NULL,
      CFNotificationSuspensionBehaviorDeliverImmediately
    );
  }
  return self;
}

- (void)dealloc
{
  CFNotificationCenterRemoveObserver(
    CFNotificationCenterGetDarwinNotifyCenter(),
    (__bridge const void *)self,
    CFSTR("com.musicplayer.widgetCommand"),
    NULL
  );
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onWidgetCommand"];
}

- (void)startObserving {
  _hasListeners = YES;
}

- (void)stopObserving {
  _hasListeners = NO;
}

- (void)deliverWidgetCommand
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.musicplayer.shared"];
    [defaults synchronize];
    NSString *command = [defaults stringForKey:@"widget_command"];
    if (!command || command.length == 0) return;
    [defaults removeObjectForKey:@"widget_command"];
    [defaults synchronize];

    if (self->_hasListeners) {
      [self sendEventWithName:@"onWidgetCommand" body:@{@"command": command}];
    } else {
      // Fallback: post as URL notification for Linking
      NSString *urlString = [NSString stringWithFormat:@"musicx://%@", command];
      NSURL *url = [NSURL URLWithString:urlString];
      if (url) {
        NSDictionary *payload = @{@"url": url.absoluteString};
        [[NSNotificationCenter defaultCenter] postNotificationName:@"RCTOpenURLNotification"
                                                            object:nil
                                                          userInfo:payload];
      }
    }
  });
}

RCT_EXPORT_METHOD(updateWidget:(NSString *)title
                  artist:(NSString *)artist
                  isPlaying:(BOOL)isPlaying
                  artworkBase64:(NSString *)artworkBase64
                  progress:(double)progress
                  duration:(double)duration)
{
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.musicplayer.shared"];
  [defaults setObject:title forKey:@"widget_title"];
  [defaults setObject:artist forKey:@"widget_artist"];
  [defaults setBool:isPlaying forKey:@"widget_isPlaying"];
  [defaults setDouble:progress forKey:@"widget_progress"];
  [defaults setDouble:duration forKey:@"widget_duration"];
  // Only update artwork when a non-nil value is provided;
  // nil means "no change" (only metadata/progress update)
  if (artworkBase64 != nil) {
    if (artworkBase64.length > 0) {
      [defaults setObject:artworkBase64 forKey:@"widget_artworkBase64"];
      // Extract average color from artwork for dynamic widget background
      NSData *imgData = [[NSData alloc] initWithBase64EncodedString:artworkBase64 options:0];
      if (imgData) {
        UIImage *img = [UIImage imageWithData:imgData];
        if (img && img.CGImage) {
          int sz = 4;
          CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
          uint8_t raw[sz * sz * 4];
          memset(raw, 0, sizeof(raw));
          CGContextRef ctx = CGBitmapContextCreate(raw, sz, sz, 8, sz * 4, cs,
            kCGImageAlphaPremultipliedLast);
          if (ctx) {
            CGContextDrawImage(ctx, CGRectMake(0, 0, sz, sz), img.CGImage);
            CGContextRelease(ctx);
            double totalR = 0, totalG = 0, totalB = 0;
            int count = sz * sz;
            for (int i = 0; i < count; i++) {
              totalR += raw[i * 4];
              totalG += raw[i * 4 + 1];
              totalB += raw[i * 4 + 2];
            }
            double avgR = totalR / count / 255.0;
            double avgG = totalG / count / 255.0;
            double avgB = totalB / count / 255.0;
            [defaults setDouble:avgR forKey:@"widget_bgR"];
            [defaults setDouble:avgG forKey:@"widget_bgG"];
            [defaults setDouble:avgB forKey:@"widget_bgB"];
          }
          CGColorSpaceRelease(cs);
        }
      }
    } else {
      [defaults removeObjectForKey:@"widget_artworkBase64"];
      [defaults removeObjectForKey:@"widget_bgR"];
      [defaults removeObjectForKey:@"widget_bgG"];
      [defaults removeObjectForKey:@"widget_bgB"];
    }
  }
  [defaults synchronize];

  // Reload WidgetKit timelines via Swift helper (reliable cross-language call)
  [WidgetReloader reloadAll];
}

@end
