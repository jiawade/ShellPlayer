// src/store/index.ts
import { configureStore, Middleware } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import musicReducer from './musicSlice';

/**
 * Middleware to persist state changes that were previously side effects in reducers.
 */
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
      break;
    case 'music/hideTrack':
    case 'music/batchHide':
      AsyncStorage.setItem('@hiddenTracks', JSON.stringify(m.hiddenTrackIds)).catch(() => {});
      break;
    case 'music/setSortMode':
    case 'music/setThemeMode':
    case 'music/setPlaybackSpeed':
      AsyncStorage.setItem('@userPrefs', JSON.stringify({
        sortMode: m.sortMode, themeMode: m.themeMode, speed: m.playbackSpeed,
      })).catch(() => {});
      break;
    case 'music/addToHistory':
    case 'music/clearHistory':
      AsyncStorage.setItem('@playHistory', JSON.stringify(m.playHistory)).catch(() => {});
      break;
  }

  // Side effect: apply playback speed to TrackPlayer
  if (action.type === 'music/setPlaybackSpeed') {
    TrackPlayer.setRate(m.playbackSpeed).catch(() => {});
  }

  return result;
};

export const store = configureStore({
  reducer: { music: musicReducer },
  middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(persistMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
