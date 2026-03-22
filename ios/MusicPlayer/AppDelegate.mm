#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import <AVFoundation/AVFoundation.h>
#import <TargetConditionals.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"MusicPlayer";
  self.initialProps = @{};
  application.applicationSupportsShakeToEdit = NO;

  AVAudioSession *session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayback
                  mode:AVAudioSessionModeDefault
               options:0
                 error:nil];
  [session setActive:YES error:nil];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
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

@end
