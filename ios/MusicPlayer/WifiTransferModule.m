#import "WifiTransferModule.h"
#import <React/RCTBridge.h>
#import <GCDWebServer/GCDWebServer.h>
#import <GCDWebServer/GCDWebServerDataResponse.h>
#import <GCDWebServer/GCDWebServerMultiPartFormRequest.h>
#import <UIKit/UIKit.h>
#include <ifaddrs.h>
#include <arpa/inet.h>

@interface WifiTransferModule ()
@property (nonatomic, strong) GCDWebServer *server;
@property (nonatomic, copy) NSString *musicDir;
@property (nonatomic, copy) NSString *lrcDir;
@property (nonatomic, assign) BOOL hasListeners;
@end

@implementation WifiTransferModule

RCT_EXPORT_MODULE(WifiTransferModule);

+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onWifiFileReceived", @"onWifiClientConnected"];
}

- (void)startObserving { self.hasListeners = YES; }
- (void)stopObserving  { self.hasListeners = NO; }

static NSSet *allowedExtensions;

+ (void)initialize {
  if (self == [WifiTransferModule class]) {
    allowedExtensions = [NSSet setWithArray:@[
      @"mp3", @"flac", @"wav", @"aac", @"m4a", @"ogg", @"wma",
      @"aiff", @"alac", @"lrc", @"opus", @"ape", @"dsf", @"dff"
    ]];
  }
}

RCT_EXPORT_METHOD(startServer:(int)port
                  musicDir:(NSString *)musicDir
                  html:(NSString *)htmlContent
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self stopServerInternal];

  self.musicDir = musicDir;
  // Derive lrc dir as sibling of music dir
  self.lrcDir = [[musicDir stringByDeletingLastPathComponent] stringByAppendingPathComponent:@"lrc"];
  NSFileManager *fm = [NSFileManager defaultManager];
  if (![fm fileExistsAtPath:musicDir]) {
    [fm createDirectoryAtPath:musicDir withIntermediateDirectories:YES attributes:nil error:nil];
  }
  if (![fm fileExistsAtPath:self.lrcDir]) {
    [fm createDirectoryAtPath:self.lrcDir withIntermediateDirectories:YES attributes:nil error:nil];
  }

  self.server = [[GCDWebServer alloc] init];

  // Serve HTML at root
  __weak typeof(self) weakSelf0 = self;
  [self.server addDefaultHandlerForMethod:@"GET"
                             requestClass:[GCDWebServerRequest class]
                             processBlock:^GCDWebServerResponse *(GCDWebServerRequest* request) {
    if (weakSelf0.hasListeners) {
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf0 sendEventWithName:@"onWifiClientConnected" body:nil];
      });
    }
    return [GCDWebServerDataResponse responseWithHTML:htmlContent];
  }];

  // Handle file upload
  __weak typeof(self) weakSelf = self;
  [self.server addHandlerForMethod:@"POST"
                              path:@"/upload"
                      requestClass:[GCDWebServerMultiPartFormRequest class]
                      processBlock:^GCDWebServerResponse *(GCDWebServerRequest* request) {
    NSFileManager *fileMgr = [NSFileManager defaultManager];
    GCDWebServerMultiPartFormRequest *req = (GCDWebServerMultiPartFormRequest *)request;
    GCDWebServerMultiPartFile *file = req.files.firstObject;
    if (!file) {
      return [GCDWebServerDataResponse responseWithJSONObject:@{@"error": @"No file received"}];
    }

    // Prefer explicit 'filename' text field (UTF-8 safe) over multipart Content-Disposition
    NSString *rawName = nil;
    for (GCDWebServerMultiPartArgument *arg in req.arguments) {
      if ([arg.controlName isEqualToString:@"filename"]) {
        rawName = arg.string;
        break;
      }
    }
    if (!rawName.length) {
      rawName = file.fileName ?: [NSString stringWithFormat:@"unknown_%ld", (long)[[NSDate date] timeIntervalSince1970]];
    }
    // Decode URL-encoding applied by browser for safe transport
    rawName = [rawName stringByRemovingPercentEncoding] ?: rawName;
    NSString *safeName = [[rawName stringByReplacingOccurrencesOfString:@"/" withString:@"_"]
                          stringByReplacingOccurrencesOfString:@".." withString:@"_"];

    // Validate extension
    NSString *ext = [safeName.pathExtension lowercaseString];
    if (![allowedExtensions containsObject:ext]) {
      return [GCDWebServerDataResponse responseWithJSONObject:@{@"error": @"Unsupported file type"}];
    }

    // Choose destination: LRC files go to lrc dir, audio files go to music dir
    NSString *destDir = [ext isEqualToString:@"lrc"] ? weakSelf.lrcDir : weakSelf.musicDir;
    NSString *destPath = [destDir stringByAppendingPathComponent:safeName];
    NSError *error = nil;

    if ([fileMgr fileExistsAtPath:destPath]) {
      [fileMgr removeItemAtPath:destPath error:nil];
    }

    if ([fileMgr moveItemAtPath:file.temporaryPath toPath:destPath error:&error]) {
      NSDictionary *attrs = [fileMgr attributesOfItemAtPath:destPath error:nil];
      unsigned long long fileSize = [attrs fileSize];

      if (weakSelf.hasListeners) {
        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf sendEventWithName:@"onWifiFileReceived" body:@{
            @"filename": safeName,
            @"size": @(fileSize)
          }];
        });
      }

      return [GCDWebServerDataResponse responseWithJSONObject:@{
        @"success": @YES,
        @"filename": safeName,
        @"size": @(fileSize)
      }];
    } else {
      return [GCDWebServerDataResponse responseWithJSONObject:@{
        @"error": error.localizedDescription ?: @"Save failed"
      }];
    }
  }];

  NSError *error = nil;
  NSDictionary *options = @{
    GCDWebServerOption_Port: @((NSUInteger)port),
    GCDWebServerOption_AutomaticallySuspendInBackground: @NO,
  };
  if ([self.server startWithOptions:options error:&error]) {
    NSString *ip = [self getWifiIPAddress];
    resolve(@{
      @"ip": ip,
      @"port": @(port),
      @"url": [NSString stringWithFormat:@"http://%@:%d", ip, port]
    });
  } else {
    reject(@"START_ERROR", error.localizedDescription ?: @"Failed to start server", error);
  }
}

RCT_EXPORT_METHOD(stopServer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self stopServerInternal];
  resolve([NSNull null]);
}

RCT_EXPORT_METHOD(copyToClipboard:(NSString *)text)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIPasteboard generalPasteboard].string = text;
  });
}

- (void)stopServerInternal {
  if (self.server.isRunning) {
    [self.server stop];
  }
  self.server = nil;
}

- (NSString *)getWifiIPAddress {
  struct ifaddrs *interfaces = NULL;
  struct ifaddrs *temp = NULL;
  NSString *address = nil;

  if (getifaddrs(&interfaces) == 0) {
    temp = interfaces;
    while (temp != NULL) {
      if (temp->ifa_addr && temp->ifa_addr->sa_family == AF_INET) {
        NSString *name = [NSString stringWithUTF8String:temp->ifa_name];
        if ([name isEqualToString:@"en0"]) {
          address = [NSString stringWithUTF8String:
                     inet_ntoa(((struct sockaddr_in *)temp->ifa_addr)->sin_addr)];
        }
      }
      temp = temp->ifa_next;
    }
  }
  freeifaddrs(interfaces);
  return address ?: @"0.0.0.0";
}

- (void)dealloc {
  [self stopServerInternal];
}

@end
