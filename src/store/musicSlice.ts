// src/store/musicSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import RNFS from 'react-native-fs';
import { Track, LyricLine, RepeatMode, SortMode, ThemeMode, PlayHistoryEntry } from '../types';
import { scanAllMusic, readLrcFile, ScanProgress } from '../utils/scanner';
import { parseLRC } from '../utils/lrcParser';
import { requestStoragePermission } from '../utils/permissions';
import { logCrash, logInfo } from '../utils/crashLogger';
import { saveArtworkFile } from '../utils/artworkCache';

interface MusicState {
  tracks: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  lyrics: LyricLine[];
  currentLyricIndex: number;
  showFullPlayer: boolean;
  showLyrics: boolean;
  repeatMode: RepeatMode;
  isScanning: boolean;
  scanError: string | null;
  favoriteIds: string[];
  scanDirectories: string[];
  searchQuery: string;
  hiddenTrackIds: string[];
  scanProgress: ScanProgress | null;
  // New features
  sortMode: SortMode;
  themeMode: ThemeMode;
  playHistory: PlayHistoryEntry[];
  playbackSpeed: number;
  sleepTimerEnd: number | null; // timestamp when timer expires
  playQueue: Track[]; // current play queue for queue viewer
  batchSelectMode: boolean;
  batchSelectedIds: string[];
}

const initialState: MusicState = {
  tracks: [],
  currentTrack: null,
  currentIndex: -1,
  isPlaying: false,
  lyrics: [],
  currentLyricIndex: -1,
  showFullPlayer: false,
  showLyrics: false,
  repeatMode: 'off',
  isScanning: false,
  scanError: null,
  favoriteIds: [],
  scanDirectories: [],
  searchQuery: '',
  hiddenTrackIds: [],
  scanProgress: null,
  sortMode: 'title',
  themeMode: 'dark',
  playHistory: [],
  playbackSpeed: 1.0,
  sleepTimerEnd: null,
  playQueue: [],
  batchSelectMode: false,
  batchSelectedIds: [],
};

// --- Async thunks ---

export const scanMusic = createAsyncThunk(
  'music/scan',
  async (directories: string[], { dispatch }) => {
    await logInfo(`Scanning ${directories.length} dirs`, 'scanMusic');
    const ok = await requestStoragePermission();
    if (!ok) throw new Error('没有存储权限，无法扫描音乐文件');
    const tracks = await scanAllMusic(directories, (p) => dispatch(setScanProgress(p)));
    try {
      const lite = tracks.map(t => ({ ...t, artwork: t.artwork ? '<<HAS>>' : undefined }));
      await AsyncStorage.setItem('@trackCache', JSON.stringify(lite));
    } catch (e) { await logCrash(e instanceof Error ? e : new Error(String(e)), 'cache'); }
    try {
      const withArt = tracks.filter(t => t.artwork && t.artwork.startsWith('data:'));
      for (let i = 0; i < withArt.length; i += 10) {
        await Promise.all(withArt.slice(i, i + 10).map(t => saveArtworkFile(t.id, t.artwork!)));
      }
    } catch {}
    return { tracks, directories };
  },
);

export const loadCachedTracks = createAsyncThunk('music/loadCache', async () => {
  try {
    const data = await AsyncStorage.getItem('@trackCache');
    if (!data) return [];
    const cached = JSON.parse(data) as Track[];
    const tracks = cached.map(t => ({ ...t, artwork: t.artwork === '<<HAS>>' ? undefined : t.artwork }));
    try {
      const { getCachedArtwork } = require('../utils/artworkCache');
      for (const t of tracks) { if (!t.artwork) { const a = await getCachedArtwork(t.id); if (a) t.artwork = a; } }
    } catch {}
    return tracks;
  } catch { return []; }
});

export const loadFavorites = createAsyncThunk('music/loadFavorites', async () => {
  try { return JSON.parse((await AsyncStorage.getItem('@favorites')) || '[]'); } catch { return []; }
});
export const loadScanDirs = createAsyncThunk('music/loadScanDirs', async () => {
  try { return JSON.parse((await AsyncStorage.getItem('@scanDirs')) || '[]'); } catch { return []; }
});
export const loadHiddenTracks = createAsyncThunk('music/loadHidden', async () => {
  try { return JSON.parse((await AsyncStorage.getItem('@hiddenTracks')) || '[]'); } catch { return []; }
});
export const loadPlayHistory = createAsyncThunk('music/loadHistory', async () => {
  try { return JSON.parse((await AsyncStorage.getItem('@playHistory')) || '[]'); } catch { return []; }
});
export const loadUserPrefs = createAsyncThunk('music/loadPrefs', async () => {
  try { return JSON.parse((await AsyncStorage.getItem('@userPrefs')) || '{}'); } catch { return {}; }
});

export const playTrack = createAsyncThunk(
  'music/playTrack',
  async ({ track, queue, shuffle }: { track: Track; queue: Track[]; shuffle?: boolean }, { dispatch, getState }) => {
    try {
      let idx = queue.findIndex(t => t.id === track.id);
      if (idx < 0) idx = 0;

      const start = Math.max(0, idx - 10);
      const end = Math.min(queue.length, idx + 11);
      const sub = queue.slice(start, end);
      const si = idx - start;

      try { await TrackPlayer.reset(); } catch {
        await new Promise(r => setTimeout(r, 200));
        try { await TrackPlayer.reset(); } catch {}
      }

      await TrackPlayer.add(sub.map(t => ({
        id: t.id, url: t.url, title: t.title, artist: t.artist, artwork: t.artwork,
      })));
      if (si > 0) await TrackPlayer.skip(si);

      // Apply saved playback speed
      const state = getState() as { music: MusicState };
      try { await TrackPlayer.setRate(state.music.playbackSpeed); } catch {}

      await TrackPlayer.play();

      try {
        if (track.lrcPath) dispatch(setLyrics(parseLRC(await readLrcFile(track.lrcPath))));
        else if (track.embeddedLyrics) dispatch(setLyrics(parseLRC(track.embeddedLyrics)));
        else dispatch(setLyrics([]));
      } catch { dispatch(setLyrics([])); }

      // Add to play history
      dispatch(addToHistory(track.id));

      // Store play queue
      dispatch(setPlayQueue(queue));

      return { track, index: idx };
    } catch (err) {
      await logCrash(err instanceof Error ? err : new Error(String(err)), 'playTrack');
      return { track, index: 0 };
    }
  },
);

export const deleteTrackPermanently = createAsyncThunk('music/deletePermanent', async (id: string) => {
  try {
    if (await RNFS.exists(id)) await RNFS.unlink(id);
    const dot = id.lastIndexOf('.');
    if (dot > 0) { const lrc = id.substring(0, dot) + '.lrc'; if (await RNFS.exists(lrc)) await RNFS.unlink(lrc); }
  } catch {} return id;
});

// --- Slice ---

const musicSlice = createSlice({
  name: 'music',
  initialState,
  reducers: {
    setCurrentTrack: (s, a: PayloadAction<Track | null>) => { s.currentTrack = a.payload; },
    setIsPlaying: (s, a: PayloadAction<boolean>) => { s.isPlaying = a.payload; },
    setLyrics: (s, a: PayloadAction<LyricLine[]>) => { s.lyrics = a.payload; s.currentLyricIndex = -1; },
    setCurrentLyricIndex: (s, a: PayloadAction<number>) => { s.currentLyricIndex = a.payload; },
    setShowFullPlayer: (s, a: PayloadAction<boolean>) => { s.showFullPlayer = a.payload; },
    toggleShowLyrics: (s) => { s.showLyrics = !s.showLyrics; },
    setRepeatMode: (s, a: PayloadAction<RepeatMode>) => { s.repeatMode = a.payload; },
    toggleFavorite: (s, a: PayloadAction<string>) => {
      const id = a.payload; const idx = s.favoriteIds.indexOf(id);
      if (idx >= 0) s.favoriteIds.splice(idx, 1); else s.favoriteIds.push(id);
      const t = s.tracks.find(x => x.id === id); if (t) t.isFavorite = idx < 0;
      AsyncStorage.setItem('@favorites', JSON.stringify(s.favoriteIds)).catch(() => {});
    },
    setCurrentIndex: (s, a: PayloadAction<number>) => { s.currentIndex = a.payload; },
    setSearchQuery: (s, a: PayloadAction<string>) => { s.searchQuery = a.payload; },
    setScanDirectories: (s, a: PayloadAction<string[]>) => {
      s.scanDirectories = a.payload;
      AsyncStorage.setItem('@scanDirs', JSON.stringify(a.payload)).catch(() => {});
    },
    setScanProgress: (s, a: PayloadAction<ScanProgress | null>) => { s.scanProgress = a.payload; },
    hideTrack: (s, a: PayloadAction<string>) => {
      const id = a.payload;
      if (!s.hiddenTrackIds.includes(id)) s.hiddenTrackIds.push(id);
      s.tracks = s.tracks.filter(t => t.id !== id);
      AsyncStorage.setItem('@hiddenTracks', JSON.stringify(s.hiddenTrackIds)).catch(() => {});
    },
    // Sort
    setSortMode: (s, a: PayloadAction<SortMode>) => {
      s.sortMode = a.payload;
      AsyncStorage.setItem('@userPrefs', JSON.stringify({ sortMode: a.payload, themeMode: s.themeMode, speed: s.playbackSpeed })).catch(() => {});
    },
    // Theme
    setThemeMode: (s, a: PayloadAction<ThemeMode>) => {
      s.themeMode = a.payload;
      AsyncStorage.setItem('@userPrefs', JSON.stringify({ sortMode: s.sortMode, themeMode: a.payload, speed: s.playbackSpeed })).catch(() => {});
    },
    // Play history
    addToHistory: (s, a: PayloadAction<string>) => {
      const entry: PlayHistoryEntry = { trackId: a.payload, playedAt: Date.now() };
      // Remove duplicate then add to front
      s.playHistory = [entry, ...s.playHistory.filter(h => h.trackId !== a.payload)].slice(0, 100);
      AsyncStorage.setItem('@playHistory', JSON.stringify(s.playHistory)).catch(() => {});
    },
    clearHistory: (s) => {
      s.playHistory = [];
      AsyncStorage.setItem('@playHistory', '[]').catch(() => {});
    },
    // Playback speed
    setPlaybackSpeed: (s, a: PayloadAction<number>) => {
      s.playbackSpeed = a.payload;
      TrackPlayer.setRate(a.payload).catch(() => {});
      AsyncStorage.setItem('@userPrefs', JSON.stringify({ sortMode: s.sortMode, themeMode: s.themeMode, speed: a.payload })).catch(() => {});
    },
    // Sleep timer
    setSleepTimer: (s, a: PayloadAction<number | null>) => {
      s.sleepTimerEnd = a.payload;
    },
    // Play queue
    setPlayQueue: (s, a: PayloadAction<Track[]>) => { s.playQueue = a.payload; },
    // Batch select
    toggleBatchMode: (s) => {
      s.batchSelectMode = !s.batchSelectMode;
      if (!s.batchSelectMode) s.batchSelectedIds = [];
    },
    toggleBatchSelect: (s, a: PayloadAction<string>) => {
      const id = a.payload;
      const idx = s.batchSelectedIds.indexOf(id);
      if (idx >= 0) s.batchSelectedIds.splice(idx, 1);
      else s.batchSelectedIds.push(id);
    },
    batchFavorite: (s) => {
      for (const id of s.batchSelectedIds) {
        if (!s.favoriteIds.includes(id)) s.favoriteIds.push(id);
        const t = s.tracks.find(x => x.id === id); if (t) t.isFavorite = true;
      }
      AsyncStorage.setItem('@favorites', JSON.stringify(s.favoriteIds)).catch(() => {});
      s.batchSelectMode = false; s.batchSelectedIds = [];
    },
    batchHide: (s) => {
      for (const id of s.batchSelectedIds) {
        if (!s.hiddenTrackIds.includes(id)) s.hiddenTrackIds.push(id);
      }
      s.tracks = s.tracks.filter(t => !s.batchSelectedIds.includes(t.id));
      AsyncStorage.setItem('@hiddenTracks', JSON.stringify(s.hiddenTrackIds)).catch(() => {});
      s.batchSelectMode = false; s.batchSelectedIds = [];
    },
    selectAllBatch: (s) => { s.batchSelectedIds = s.tracks.map(t => t.id); },
    clearBatchSelect: (s) => { s.batchSelectedIds = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(scanMusic.pending, (s) => { s.isScanning = true; s.scanError = null; s.scanProgress = null; })
      .addCase(scanMusic.fulfilled, (s, a) => {
        s.isScanning = false; s.scanProgress = null;
        s.tracks = a.payload.tracks.filter(t => !s.hiddenTrackIds.includes(t.id));
        s.scanDirectories = a.payload.directories;
        for (const t of s.tracks) t.isFavorite = s.favoriteIds.includes(t.id);
      })
      .addCase(scanMusic.rejected, (s, a) => { s.isScanning = false; s.scanProgress = null; s.scanError = a.error.message || '扫描失败'; })
      .addCase(loadCachedTracks.fulfilled, (s, a) => {
        if (a.payload.length > 0 && s.tracks.length === 0) {
          s.tracks = a.payload.filter(t => !s.hiddenTrackIds.includes(t.id));
          for (const t of s.tracks) t.isFavorite = s.favoriteIds.includes(t.id);
        }
      })
      .addCase(loadFavorites.fulfilled, (s, a) => { s.favoriteIds = a.payload; for (const t of s.tracks) t.isFavorite = s.favoriteIds.includes(t.id); })
      .addCase(loadScanDirs.fulfilled, (s, a) => { s.scanDirectories = a.payload; })
      .addCase(loadHiddenTracks.fulfilled, (s, a) => { s.hiddenTrackIds = a.payload; })
      .addCase(loadPlayHistory.fulfilled, (s, a) => { s.playHistory = a.payload; })
      .addCase(loadUserPrefs.fulfilled, (s, a) => {
        const p = a.payload as any;
        if (p.sortMode) s.sortMode = p.sortMode;
        if (p.themeMode) s.themeMode = p.themeMode;
        if (p.speed) s.playbackSpeed = p.speed;
      })
      .addCase(playTrack.fulfilled, (s, a) => { s.currentTrack = a.payload.track; s.currentIndex = a.payload.index; s.isPlaying = true; })
      .addCase(deleteTrackPermanently.fulfilled, (s, a) => { s.tracks = s.tracks.filter(t => t.id !== a.payload); });
  },
});

export const {
  setCurrentTrack, setIsPlaying, setLyrics, setCurrentLyricIndex,
  setShowFullPlayer, toggleShowLyrics, setRepeatMode,
  toggleFavorite, setCurrentIndex, setSearchQuery, setScanDirectories,
  setScanProgress, hideTrack, setSortMode, setThemeMode,
  addToHistory, clearHistory, setPlaybackSpeed, setSleepTimer,
  setPlayQueue, toggleBatchMode, toggleBatchSelect,
  batchFavorite, batchHide, selectAllBatch, clearBatchSelect,
} = musicSlice.actions;
export default musicSlice.reducer;
