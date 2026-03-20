// src/service.ts
import TrackPlayer, {Event} from 'react-native-track-player';
import {rebindEqualizer} from './utils/equalizer';
import {store} from './store';
import {playTrack} from './store/musicSlice';

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    const state = store.getState().music;
    const queue = state.playQueue.length > 0 ? state.playQueue : state.tracks;

    // Shuffle mode: random next
    if (state.repeatMode === 'queue' && queue.length > 1) {
      const candidates = queue.filter(t => t.id !== state.currentTrack?.id);
      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        store.dispatch(playTrack({track: random, queue}));
      }
      return;
    }

    // Non-shuffle: check if TP queue has a next track
    try {
      const activeIdx = await TrackPlayer.getActiveTrackIndex();
      const tpQueue = await TrackPlayer.getQueue();
      if (activeIdx != null && activeIdx < tpQueue.length - 1) {
        await TrackPlayer.skipToNext();
        return;
      }
    } catch {}

    // TP queue exhausted — find next from full play queue
    if (queue.length > 0 && state.currentTrack) {
      const currentIdx = queue.findIndex(t => t.id === state.currentTrack!.id);
      if (currentIdx >= 0) {
        const nextIdx = (currentIdx + 1) % queue.length;
        store.dispatch(playTrack({track: queue[nextIdx], queue}));
      }
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const state = store.getState().music;
    const queue = state.playQueue.length > 0 ? state.playQueue : state.tracks;

    // Shuffle mode: use play history
    if (state.repeatMode === 'queue' && queue.length > 1) {
      if (state.playHistory.length >= 2) {
        const prevEntry = state.playHistory[1];
        const prevTrack = queue.find(t => t.id === prevEntry.trackId);
        if (prevTrack) {
          store.dispatch(playTrack({track: prevTrack, queue}));
          return;
        }
      }
    }

    // Non-shuffle: check if TP queue has a previous track
    try {
      const activeIdx = await TrackPlayer.getActiveTrackIndex();
      if (activeIdx != null && activeIdx > 0) {
        await TrackPlayer.skipToPrevious();
        return;
      }
    } catch {}

    // TP queue exhausted — find previous from full play queue
    if (queue.length > 0 && state.currentTrack) {
      const currentIdx = queue.findIndex(t => t.id === state.currentTrack!.id);
      if (currentIdx >= 0) {
        const prevIdx = (currentIdx - 1 + queue.length) % queue.length;
        store.dispatch(playTrack({track: queue[prevIdx], queue}));
      }
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, e =>
    TrackPlayer.seekTo(e.position),
  );

  // When a new track starts playing, rebind the equalizer to the active audio session
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
    rebindEqualizer();
  });

  // Handle queue exhaustion: when TrackPlayer finishes its internal queue,
  // auto-continue to the next track from the full play queue
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    const state = store.getState().music;
    const queue = state.playQueue.length > 0 ? state.playQueue : state.tracks;

    if (state.repeatMode === 'queue' && queue.length > 1) {
      // Shuffle mode: random next
      const candidates = queue.filter(t => t.id !== state.currentTrack?.id);
      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        store.dispatch(playTrack({track: random, queue}));
      }
    } else if (state.repeatMode !== 'track' && queue.length > 0 && state.currentTrack) {
      // Sequential mode: continue to next if not at the end of playlist
      const currentIdx = queue.findIndex(t => t.id === state.currentTrack!.id);
      if (currentIdx >= 0 && currentIdx < queue.length - 1) {
        store.dispatch(playTrack({track: queue[currentIdx + 1], queue}));
      }
    }
  });
}
