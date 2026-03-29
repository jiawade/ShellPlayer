declare module 'react-native-vlc-media-player' {
  import { ComponentType } from 'react';

  export interface VLCPlayerProps {
    style?: any;
    source?: any;
    paused?: boolean;
    muted?: boolean;
    volume?: number;
    seek?: number;
    rate?: number;
    onPlaying?: () => void;
    onPaused?: () => void;
    onStopped?: () => void;
    onEnd?: () => void;
    onEnded?: () => void;
    onError?: (event: any) => void;
    onProgress?: (event: any) => void;
  }

  export const VLCPlayer: ComponentType<VLCPlayerProps>;
}
