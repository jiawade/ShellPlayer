#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface MusicWidgetModule : RCTEventEmitter <RCTBridgeModule>
- (void)deliverWidgetCommand;
@end
