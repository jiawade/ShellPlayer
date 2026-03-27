#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTDevLoadingView.h>
#import <React/RCTRootView.h>
#import <AVFoundation/AVFoundation.h>
#import <TargetConditionals.h>

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

@end
