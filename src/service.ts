// src/service.ts
import TrackPlayer, {Event} from 'react-native-track-player';
import {rebindEqualizer} from './utils/equalizer';
import {store} from './store';
import {playTrack, setPlaybackErrorMsg} from './store/musicSlice';
import {exportTrackToFile} from './utils/mediaLibrary';
import {recordPlay} from './utils/reviewPrompt';
import {loadBluetoothLyricsSetting} from './utils/bluetoothLyrics';
import {startLiveActivity, stopLiveActivity} from './utils/liveActivity';
import i18n from './i18n';

/**
 * Preload the next track into TrackPlayer's queue for gapless playback.
 * Ensures the TP queue always has the current + next track ready.
 */
async function preloadNextTrack() {
  try {
    const state = store.getState().music;
    const queue = state.playQueue.length > 0 ? state.playQueue : state.tracks;
    if (!state.currentTrack || queue.length <= 1) return;

    // Don't preload if repeat-one mode
    if (state.repeatMode === 'track') return;

    const currentIdx = queue.findIndex(t => t.id === state.currentTrack!.id);
    if (currentIdx < 0) return;

    let nextTrack: typeof queue[number] | undefined;
    if (state.repeatMode === 'queue') {
      // Shuffle: pick a random next (deterministic preload for gapless)
      const candidates = queue.filter(t => t.id !== state.currentTrack!.id);
      if (candidates.length === 0) return;
      nextTrack = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // Sequential: preload next in order (don't wrap around at end)
      if (currentIdx >= queue.length - 1) return;
      nextTrack = queue[currentIdx + 1];
    }

    // Check if already in TP queue
    if (!nextTrack) return;
    const tpQueue = await TrackPlayer.getQueue();
    if (tpQueue.some(t => t.id === nextTrack!.id)) return;

    const url = nextTrack!.url.startsWith('ipod-library://')
      ? await exportTrackToFile(nextTrack!.url)
      : nextTrack!.url;

    await TrackPlayer.add({
      id: nextTrack!.id,
      url,
      title: nextTrack!.title,
      artist: nextTrack!.artist,
      artwork: nextTrack!.artwork,
    });
  } catch {}
}

export async function PlaybackService() {
  loadBluetoothLyricsSetting().catch(() => {});
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

  // Handle playback errors (unsupported format, corrupted files, etc.)
  TrackPlayer.addEventListener(Event.PlaybackError, async (e) => {
    console.warn('[PlaybackError]', e.message, e.code);
    const state = store.getState().music;
    const trackTitle = state.currentTrack?.title || '';
    store.dispatch(setPlaybackErrorMsg(
      i18n.t('playback.unsupportedFormat', { title: trackTitle }),
    ));
    // Auto-dismiss after 1.5s and skip to next track
    setTimeout(() => {
      store.dispatch(setPlaybackErrorMsg(null));
      const s = store.getState().music;
      const queue = s.playQueue.length > 0 ? s.playQueue : s.tracks;
      if (queue.length > 0 && s.currentTrack) {
        const idx = queue.findIndex(t => t.id === s.currentTrack!.id);
        if (idx >= 0) {
          const nextIdx = (idx + 1) % queue.length;
          store.dispatch(playTrack({track: queue[nextIdx], queue}));
        }
      }
    }, 1500);
  });

  // When a new track starts playing, rebind the equalizer and preload next track
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
    rebindEqualizer();
    preloadNextTrack();
    recordPlay().catch(() => {});

    // Live Activity disabled: iOS lock screen already shows Now Playing widget;
    // starting a Live Activity creates a duplicate entry.
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
