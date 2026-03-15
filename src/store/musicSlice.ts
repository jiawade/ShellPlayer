// src/store/musicSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import RNFS from 'react-native-fs';
import { Track, LyricLine, RepeatMode } from '../types';
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
  shuffleEnabled: boolean;
  isScanning: boolean;
  scanError: string | null;
  favoriteIds: string[];
  scanDirectories: string[];
  searchQuery: string;
  hiddenTrackIds: string[];
  scanProgress: ScanProgress | null;
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
  shuffleEnabled: false,
  isScanning: false,
  scanError: null,
  favoriteIds: [],
  scanDirectories: [],
  searchQuery: '',
  hiddenTrackIds: [],
  scanProgress: null,
};

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    } catch (e) { await logCrash(e instanceof Error ? e : new Error(String(e)), 'scanMusic:cache'); }
    try {
      const withArt = tracks.filter(t => t.artwork && t.artwork.startsWith('data:'));
      for (let i = 0; i < withArt.length; i += 10) {
        const batch = withArt.slice(i, i + 10);
        await Promise.all(batch.map(t => saveArtworkFile(t.id, t.artwork!)));
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
    // 尝试从文件缓存恢复封面，失败不影响列表
    try {
      const { getCachedArtwork } = require('../utils/artworkCache');
      for (const t of tracks) {
        if (!t.artwork) {
          const art = await getCachedArtwork(t.id);
          if (art) t.artwork = art;
        }
      }
    } catch {}
    return tracks;
  } catch { return []; }
});

export const loadFavorites = createAsyncThunk('music/loadFavorites', async () => {
  try { const d = await AsyncStorage.getItem('@favorites'); return d ? JSON.parse(d) : []; } catch { return []; }
});
export const loadScanDirs = createAsyncThunk('music/loadScanDirs', async () => {
  try { const d = await AsyncStorage.getItem('@scanDirs'); return d ? JSON.parse(d) : []; } catch { return []; }
});
export const loadHiddenTracks = createAsyncThunk('music/loadHidden', async () => {
  try { const d = await AsyncStorage.getItem('@hiddenTracks'); return d ? JSON.parse(d) : []; } catch { return []; }
});

/**
 * 播放曲目 — 随机模式时打乱队列顺序
 */
export const playTrack = createAsyncThunk(
  'music/playTrack',
  async ({ track, queue, shuffle }: { track: Track; queue: Track[]; shuffle?: boolean }, { dispatch }) => {
    try {
      let playQueue: Track[];
      let trackIndex: number;

      if (shuffle) {
        // 随机模式：打乱队列，但把选中歌曲放到第一位
        const rest = queue.filter(t => t.id !== track.id);
        const shuffled = shuffleArray(rest);
        playQueue = [track, ...shuffled];
        trackIndex = 0;
      } else {
        playQueue = queue;
        trackIndex = queue.findIndex(t => t.id === track.id);
        if (trackIndex < 0) trackIndex = 0;
      }

      // 只加载前后各10首
      const start = Math.max(0, trackIndex - 10);
      const end = Math.min(playQueue.length, trackIndex + 11);
      const sub = playQueue.slice(start, end);
      const si = trackIndex - start;

      try { await TrackPlayer.reset(); } catch {
        await new Promise(r => setTimeout(r, 200));
        try { await TrackPlayer.reset(); } catch {}
      }

      await TrackPlayer.add(sub.map(t => ({
        id: t.id, url: t.url, title: t.title, artist: t.artist, artwork: t.artwork,
      })));
      if (si > 0) await TrackPlayer.skip(si);
      await TrackPlayer.play();

      try {
        if (track.lrcPath) dispatch(setLyrics(parseLRC(await readLrcFile(track.lrcPath))));
        else if (track.embeddedLyrics) dispatch(setLyrics(parseLRC(track.embeddedLyrics)));
        else dispatch(setLyrics([]));
      } catch { dispatch(setLyrics([])); }

      return { track, index: trackIndex };
    } catch (err) {
      await logCrash(err instanceof Error ? err : new Error(String(err)), 'playTrack');
      return { track, index: 0 };
    }
  },
);

export const deleteTrackPermanently = createAsyncThunk('music/deletePermanent', async (trackId: string) => {
  try {
    if (await RNFS.exists(trackId)) await RNFS.unlink(trackId);
    const dot = trackId.lastIndexOf('.');
    if (dot > 0) { const lrc = trackId.substring(0, dot) + '.lrc'; if (await RNFS.exists(lrc)) await RNFS.unlink(lrc); }
  } catch {} return trackId;
});

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
    toggleShuffle: (s) => { s.shuffleEnabled = !s.shuffleEnabled; },
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
      .addCase(playTrack.fulfilled, (s, a) => { s.currentTrack = a.payload.track; s.currentIndex = a.payload.index; s.isPlaying = true; })
      .addCase(deleteTrackPermanently.fulfilled, (s, a) => { s.tracks = s.tracks.filter(t => t.id !== a.payload); });
  },
});

export const {
  setCurrentTrack, setIsPlaying, setLyrics, setCurrentLyricIndex,
  setShowFullPlayer, toggleShowLyrics, setRepeatMode, toggleShuffle,
  toggleFavorite, setCurrentIndex, setSearchQuery, setScanDirectories,
  setScanProgress, hideTrack,
} = musicSlice.actions;
export default musicSlice.reducer;
