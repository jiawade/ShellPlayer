// src/service.ts
import TrackPlayer, {Event} from 'react-native-track-player';
import {rebindEqualizer} from './utils/equalizer';

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    TrackPlayer.skipToNext(),
  );
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious(),
  );
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, e =>
    TrackPlayer.seekTo(e.position),
  );

  // When a new track starts playing, rebind the equalizer to the active audio session
  // This ensures the EQ effects are applied to ExoPlayer's actual audio output
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
    rebindEqualizer();
  });
}
