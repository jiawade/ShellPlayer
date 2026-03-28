// src/service.ts
import TrackPlayer, { Event } from 'react-native-track-player';
import { rebindEqualizer } from './utils/equalizer';
import { store } from './store';
import {
  playTrack,
  setPlaybackErrorMsg,
  setCurrentTrack,
  addToHistory,
  shuffleHistoryBack,
  shuffleHistoryForward,
  removeFromPlayQueue,
  hideTrack,
} from './store/musicSlice';
import { exportTrackToFile } from './utils/mediaLibrary';
import { recordPlay } from './utils/reviewPrompt';
import { loadBluetoothLyricsSetting } from './utils/bluetoothLyrics';
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

    // Don't preload in shuffle mode — next track is determined at play time,
    // and preloading a random track causes race conditions with skip/queue-end handlers
    if (state.repeatMode === 'queue') return;

    const currentIdx = queue.findIndex(t => t.id === state.currentTrack!.id);
    if (currentIdx < 0) return;

    let nextTrack: (typeof queue)[number] | undefined;
    // Sequential: preload next in order (don't wrap around at end)
    if (currentIdx >= queue.length - 1) return;
    nextTrack = queue[currentIdx + 1];

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

    // Shuffle mode: use shuffle history for navigation
    if (state.repeatMode === 'queue' && queue.length > 1) {
      // If we went back in history, go forward through existing history first
      if (state.shuffleHistoryIndex < state.shuffleHistory.length - 1) {
        const nextId = state.shuffleHistory[state.shuffleHistoryIndex + 1];
        const nextTrack = queue.find(t => t.id === nextId);
        if (nextTrack) {
          store.dispatch(shuffleHistoryForward());
          store.dispatch(playTrack({ track: nextTrack, queue, navigatingShuffleHistory: true }));
          return;
        }
      }
      // At end of history: pick new random track
      const candidates = queue.filter(t => t.id !== state.currentTrack?.id);
      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        store.dispatch(playTrack({ track: random, queue }));
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
        store.dispatch(playTrack({ track: queue[nextIdx], queue }));
      }
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const state = store.getState().music;
    const queue = state.playQueue.length > 0 ? state.playQueue : state.tracks;

    // Shuffle mode: navigate back through shuffle history
    if (state.repeatMode === 'queue' && queue.length > 1) {
      if (state.shuffleHistoryIndex > 0) {
        const prevId = state.shuffleHistory[state.shuffleHistoryIndex - 1];
        const prevTrack = queue.find(t => t.id === prevId);
        if (prevTrack) {
          store.dispatch(shuffleHistoryBack());
          store.dispatch(playTrack({ track: prevTrack, queue, navigatingShuffleHistory: true }));
          return;
        }
      }
      // At beginning of shuffle history — do nothing
      return;
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
        store.dispatch(playTrack({ track: queue[prevIdx], queue }));
      }
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, e => TrackPlayer.seekTo(e.position));

  // Handle playback errors (unsupported format, corrupted files, etc.)
  TrackPlayer.addEventListener(Event.PlaybackError, async e => {
    console.warn('[PlaybackError]', e.message, e.code);
    const state = store.getState().music;
    const trackTitle = state.currentTrack?.title || '';
    const failedTrackId = state.currentTrack?.id;
    store.dispatch(
      setPlaybackErrorMsg(i18n.t('playback.unsupportedFormat', { title: trackTitle })),
    );

    // Remove the failed track from both playQueue AND tracks (hide it)
    if (failedTrackId) {
      store.dispatch(removeFromPlayQueue(failedTrackId));
      store.dispatch(hideTrack(failedTrackId));
    }

    // Auto-dismiss after 1.5s and skip to next track
    setTimeout(() => {
      store.dispatch(setPlaybackErrorMsg(null));
      if (!failedTrackId) return;
      const s = store.getState().music;
      const queue = s.playQueue.length > 0 ? s.playQueue : s.tracks;
      // Only auto-play if there are remaining tracks different from the failed one
      const remaining = queue.filter(t => t.id !== failedTrackId);
      if (remaining.length > 0) {
        store.dispatch(playTrack({ track: remaining[0], queue: remaining }));
      }
    }, 1500);
  });

  // When a new track starts playing, rebind the equalizer and preload next track
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event: any) => {
    // Sync Redux state immediately for auto-advanced tracks (e.g. gapless preload in sequential mode)
    // This ensures currentTrack is always in sync before preloadNextTrack reads it.
    const nextTrack = event?.track;
    if (nextTrack?.id) {
      const state = store.getState().music;
      if (state.currentTrack?.id !== nextTrack.id) {
        const q = state.playQueue.length > 0 ? state.playQueue : state.tracks;
        const matched = q.find(t => t.id === nextTrack.id);
        if (matched) {
          store.dispatch(setCurrentTrack(matched));
          store.dispatch(addToHistory(matched.id));
        }
      }
    }

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
        store.dispatch(playTrack({ track: random, queue }));
      }
    } else if (state.repeatMode !== 'track' && queue.length > 0 && state.currentTrack) {
      // Sequential mode: continue to next if not at the end of playlist
      const currentIdx = queue.findIndex(t => t.id === state.currentTrack!.id);
      if (currentIdx >= 0 && currentIdx < queue.length - 1) {
        store.dispatch(playTrack({ track: queue[currentIdx + 1], queue }));
      }
    }
  });
}
