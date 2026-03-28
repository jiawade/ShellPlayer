// LiveActivityBridge.m
// Obj-C bridge for React Native to access LiveActivityManager (Swift)
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityManager, NSObject)

RCT_EXTERN_METHOD(start:(NSString *)trackId
                  title:(NSString *)title
                  artist:(NSString *)artist
                  artworkBase64:(NSString *)artworkBase64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(update:(BOOL)isPlaying
                  title:(NSString *)title
                  artist:(NSString *)artist
                  progress:(double)progress
                  artworkBase64:(NSString *)artworkBase64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
