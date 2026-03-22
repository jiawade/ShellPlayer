// src/store/index.ts
import { configureStore, Middleware } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import musicReducer from './musicSlice';
import playlistReducer from './playlistSlice';
import proReducer from './proSlice';
import statsReducer from './statsSlice';

const serializeArtworkForCache = (artwork?: string): string | undefined => {
  if (!artwork) return undefined;
  return artwork.startsWith('data:') ? '<<HAS>>' : artwork;
};

const persistMiddleware: Middleware = (storeApi) => (next) => (action: any) => {
  const result = next(action);
  const state = storeApi.getState() as RootState;
  const m = state.music;

  switch (action.type) {
    case 'music/toggleFavorite':
    case 'music/batchFavorite':
      AsyncStorage.setItem('@favorites', JSON.stringify(m.favoriteIds)).catch(() => {});
      break;
    case 'music/setScanDirectories':
    case 'music/scan/fulfilled':
    case 'music/importiOS/fulfilled':
      AsyncStorage.setItem('@scanDirs', JSON.stringify(m.scanDirectories)).catch(() => {});
      {
        const lite = m.tracks.map((t: any) => ({
          ...t,
          artwork: serializeArtworkForCache(t.artwork),
        }));
        AsyncStorage.setItem('@trackCache', JSON.stringify(lite)).catch(() => {});
      }
      break;
    case 'music/hideTrack':
    case 'music/batchHide':
    case 'music/scan/pending':
    case 'music/importiOS/pending':
      AsyncStorage.setItem('@hiddenTracks', JSON.stringify(m.hiddenTrackIds)).catch(() => {});
      break;
    case 'music/setSortMode':
    case 'music/setThemeMode':
    case 'music/setPlaybackSpeed':
    case 'music/setHideDuplicates':
    case 'music/setCustomAccent':
    case 'music/setLanguage':
      AsyncStorage.setItem('@userPrefs', JSON.stringify({
        sortMode: m.sortMode, themeMode: m.themeMode, speed: m.playbackSpeed,
        hideDuplicates: m.hideDuplicates, customAccent: m.customAccent,
        language: m.language,
      })).catch(() => {});
      break;
    case 'music/addToHistory':
    case 'music/clearHistory':
      AsyncStorage.setItem('@playHistory', JSON.stringify(m.playHistory)).catch(() => {});
      break;
    case 'music/setCurrentTrack':
      if (m.currentTrack) {
        AsyncStorage.setItem('@lastPlayback', JSON.stringify({
          trackId: m.currentTrack.id, position: 0,
        })).catch(() => {});
      }
      break;
  }

  if (action.type.startsWith('playlist/') && action.type !== 'playlist/load/fulfilled'
      && action.type !== 'playlist/load/pending' && action.type !== 'playlist/load/rejected') {
    const pl = state.playlist;
    AsyncStorage.setItem('@playlists', JSON.stringify(pl.playlists)).catch(() => {});
  }

  if (action.type === 'stats/recordListenTime') {
    AsyncStorage.setItem('@play_stats', JSON.stringify(state.stats)).catch(() => {});
  }

  if (action.type === 'music/setPlaybackSpeed') {
    TrackPlayer.setRate(m.playbackSpeed).catch(() => {});
  }

  return result;
};

export const store = configureStore({
  reducer: { music: musicReducer, playlist: playlistReducer, pro: proReducer, stats: statsReducer },
  middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(persistMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
