// src/hooks/useWidgetSync.ts
// Syncs current playback state to Android/iOS home screen widgets
// Also handles incoming widget deep-link actions (iOS)
import { useEffect, useRef } from 'react';
import { Linking, NativeModules, Platform } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { useProgress } from 'react-native-track-player';
import { useAppSelector } from '../store';
import { store } from '../store';
import {
  playTrack,
  shuffleHistoryForward,
  shuffleHistoryBack,
} from '../store/musicSlice';
import RNFS from 'react-native-fs';

const { MusicWidgetModule } = NativeModules;

function handleWidgetURL(url: string | null) {
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'musicx:') return;
    const action = parsed.hostname || parsed.host;
    switch (action) {
      case 'play_pause':
      case 'toggle':
        TrackPlayer.getPlaybackState().then(state => {
          const s = typeof state === 'object' ? (state as any).state : state;
          if (s === 'playing') {
            TrackPlayer.pause();
          } else {
            TrackPlayer.play();
          }
        });
        break;
      case 'next': {
        const st = store.getState().music;
        const queue = st.playQueue.length > 0 ? st.playQueue : st.tracks;
        if (st.repeatMode === 'queue' && queue.length > 1) {
          if (st.shuffleHistoryIndex < st.shuffleHistory.length - 1) {
            const nextId = st.shuffleHistory[st.shuffleHistoryIndex + 1];
            const nextTrack = queue.find(t => t.id === nextId);
            if (nextTrack) {
              store.dispatch(shuffleHistoryForward());
              store.dispatch(playTrack({ track: nextTrack, queue, navigatingShuffleHistory: true }));
              break;
            }
          }
          const candidates = queue.filter(t => t.id !== st.currentTrack?.id);
          if (candidates.length > 0) {
            const random = candidates[Math.floor(Math.random() * candidates.length)];
            store.dispatch(playTrack({ track: random, queue }));
          }
        } else if (queue.length > 0 && st.currentTrack) {
          const currentIdx = queue.findIndex(t => t.id === st.currentTrack!.id);
          if (currentIdx >= 0) {
            const nextIdx = (currentIdx + 1) % queue.length;
            store.dispatch(playTrack({ track: queue[nextIdx], queue }));
          }
        }
        break;
      }
      case 'prev': {
        const st = store.getState().music;
        const queue = st.playQueue.length > 0 ? st.playQueue : st.tracks;
        if (st.repeatMode === 'queue' && queue.length > 1) {
          if (st.shuffleHistoryIndex > 0) {
            const prevId = st.shuffleHistory[st.shuffleHistoryIndex - 1];
            const prevTrack = queue.find(t => t.id === prevId);
            if (prevTrack) {
              store.dispatch(shuffleHistoryBack());
              store.dispatch(playTrack({ track: prevTrack, queue, navigatingShuffleHistory: true }));
            }
          }
        } else if (queue.length > 0 && st.currentTrack) {
          const currentIdx = queue.findIndex(t => t.id === st.currentTrack!.id);
          if (currentIdx >= 0) {
            const prevIdx = (currentIdx - 1 + queue.length) % queue.length;
            store.dispatch(playTrack({ track: queue[prevIdx], queue }));
          }
        }
        break;
      }
    }
  } catch {}
}

export function useWidgetSync() {
  const { currentTrack, isPlaying } = useAppSelector(s => s.music);
  const { position, duration } = useProgress(2000);
  const prevRef = useRef({ id: '', isPlaying: false, progress: 0 });
  // Track which artwork has been sent to avoid resending on every progress tick
  const sentArtworkIdRef = useRef('');

  // Listen for widget deep-link actions (iOS)
  // Works with both:
  //   - Link-based buttons (iOS <17 fallback)
  //   - AppIntent openAppWhenRun=true path (iOS 17+, delivered via applicationDidBecomeActive)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Linking.getInitialURL().then(handleWidgetURL);
    const sub = Linking.addEventListener('url', (e) => handleWidgetURL(e.url));
    return () => sub.remove();
  }, []);

  // Immediate track-change push (artwork + metadata) — runs independently of progress ticks
  useEffect(() => {
    if (!MusicWidgetModule || !currentTrack) return;
    const id = currentTrack.id;
    if (sentArtworkIdRef.current === id) return; // already sent

    const title = currentTrack.title || 'Music X';
    const artist = currentTrack.artist || '';
    const artwork = currentTrack.artwork || null;
    const playing = isPlaying;

    if (Platform.OS === 'android') {
      let artworkPath: string | null = null;
      if (artwork) {
        artworkPath = artwork.startsWith('file://') ? artwork.replace('file://', '') : artwork;
      }
      MusicWidgetModule.updateWidget(title, artist, playing, artworkPath, 0, true);
      sentArtworkIdRef.current = id;
    } else {
      const sendUpdate = (artworkB64: string | null) => {
        MusicWidgetModule.updateWidget(title, artist, playing, artworkB64, 0, duration || 0);
      };

      if (!artwork) {
        sentArtworkIdRef.current = id;
        sendUpdate('');
        return;
      }

      if (artwork.startsWith('data:')) {
        const commaIdx = artwork.indexOf(',');
        sentArtworkIdRef.current = id;
        sendUpdate(commaIdx > 0 ? artwork.substring(commaIdx + 1) : null);
        return;
      }

      const filePath = artwork.startsWith('file://') ? artwork.replace('file://', '') : artwork;
      RNFS.readFile(filePath, 'base64')
        .then(b64 => {
          sentArtworkIdRef.current = id;
          sendUpdate(b64);
        })
        .catch(() => {
          sentArtworkIdRef.current = id;
          sendUpdate(null);
        });
    }
  }, [currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress & play-state updates (no artwork re-send)
  useEffect(() => {
    if (!MusicWidgetModule) return;

    const id = currentTrack?.id ?? '';
    const playing = isPlaying;
    const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
    const progressRounded = Math.round(progress * 100) / 100;

    // Only update if something meaningful changed
    if (
      id === prevRef.current.id &&
      playing === prevRef.current.isPlaying &&
      Math.abs(progressRounded - prevRef.current.progress) < 0.005
    ) return;
    prevRef.current = { id, isPlaying: playing, progress: progressRounded };

    const title = currentTrack?.title || 'Music X';
    const artist = currentTrack?.artist || '';

    if (Platform.OS === 'android') {
      // artworkPath=null tells native to keep existing artwork
      MusicWidgetModule.updateWidget(title, artist, playing, null, progressRounded, false);
    } else {
      // null artwork → keep existing
      MusicWidgetModule.updateWidget(title, artist, playing, null, progressRounded, duration);
    }
  }, [currentTrack, isPlaying, position, duration]);
}
