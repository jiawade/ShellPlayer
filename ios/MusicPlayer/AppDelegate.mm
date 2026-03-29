#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTDevLoadingView.h>
#import <React/RCTRootView.h>
#import <AVFoundation/AVFoundation.h>
#import <TargetConditionals.h>

// Check for a pending widget command and deliver it to JS via RCTOpenURLNotification.
// Called when the app becomes active (guaranteed by openAppWhenRun = true in AppIntents).
static void deliverPendingWidgetCommand(void) {
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.musicplayer.shared"];
  [defaults synchronize]; // pick up cross-process writes from widget extension
  NSString *command = [defaults stringForKey:@"widget_command"];
  if (!command || command.length == 0) return;
  [defaults removeObjectForKey:@"widget_command"];
  [defaults synchronize];

  NSString *urlString = [NSString stringWithFormat:@"musicx://%@", command];
  NSURL *url = [NSURL URLWithString:urlString];
  if (!url) return;

  dispatch_async(dispatch_get_main_queue(), ^{
    // Small delay to ensure React bridge is ready after backgrounding
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      NSDictionary *payload = @{@"url": url.absoluteString};
      [[NSNotificationCenter defaultCenter] postNotificationName:@"RCTOpenURLNotification"
                                                          object:nil
                                                        userInfo:payload];
    });
  });
}

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"MusicPlayer";
  self.initialProps = @{};
  application.applicationSupportsShakeToEdit = NO;
  [RCTDevLoadingView setEnabled:NO];

  AVAudioSession *session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayback
                  mode:AVAudioSessionModeDefault
               options:0
                 error:nil];
  [session setActive:YES error:nil];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (void)applicationDidBecomeActive:(UIApplication *)application
{
  // Deliver any pending widget command (written by AppIntent with openAppWhenRun=true)
  deliverPendingWidgetCommand();
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (UIView *)createRootViewWithBridge:(RCTBridge *)bridge
                          moduleName:(NSString *)moduleName
                           initProps:(NSDictionary *)initProps
{
  UIView *rootView = [super createRootViewWithBridge:bridge moduleName:moduleName initProps:initProps];

  if ([rootView isKindOfClass:[RCTRootView class]]) {
    RCTRootView *reactRootView = (RCTRootView *)rootView;
    reactRootView.loadingView = nil;
    reactRootView.loadingViewFadeDelay = 0.0;
    reactRootView.loadingViewFadeDuration = 0.0;
  }

  // Match JS loading screen color to avoid flash between native → JS render
  BOOL isDark = UITraitCollection.currentTraitCollection.userInterfaceStyle == UIUserInterfaceStyleDark;
  rootView.backgroundColor = isDark
    ? [UIColor colorWithRed:11.0/255.0 green:14.0/255.0 blue:23.0/255.0 alpha:1.0]   // #0B0E17
    : [UIColor colorWithRed:245.0/255.0 green:246.0/255.0 blue:250.0/255.0 alpha:1.0]; // #F5F6FA

  return rootView;
}

- (NSURL *)getBundleURL
{
#if DEBUG
#if TARGET_OS_SIMULATOR
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  NSURL *bundleURL = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  if (bundleURL) {
    return bundleURL;
  }
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#endif
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [super application:application openURL:url options:options];
}

@end
