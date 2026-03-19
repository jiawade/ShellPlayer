// src/store/musicSlice.ts
import {createSlice, PayloadAction, createAsyncThunk} from '@reduxjs/toolkit';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import RNFS from 'react-native-fs';
import {Track, LyricLine, RepeatMode, SortMode, ThemeMode, PlayHistoryEntry} from '../types';
import {scanAllMusic, readLrcFile, findMatchingLrcInDir, ScanProgress} from '../utils/scanner';
import {parseLRC, parseTextLyrics} from '../utils/lrcParser';
import {getDefaultLrcDir, ensureDefaultDirs} from '../utils/defaultDirs';
import {requestStoragePermission} from '../utils/permissions';
import {logCrash, logInfo} from '../utils/crashLogger';
import {saveArtworkFile, getCachedArtwork, batchGetCachedArtworks} from '../utils/artworkCache';
import {importFromMediaLibrary, requestMediaLibraryPermission, exportTrackToFile, getLyricsForUrl} from '../utils/mediaLibrary';

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
  themeMode: 'system',
  playHistory: [],
  playbackSpeed: 1.0,
  sleepTimerEnd: null,
  playQueue: [],
  batchSelectMode: false,
  batchSelectedIds: [],
};

// --- Async thunks ---

export interface IOSImportOptions {
  includeIPod?: boolean;
  localDirs?: string[];
  localFiles?: string[];
}

export const importiOSMediaLibrary = createAsyncThunk(
  'music/importiOS',
  async (options: IOSImportOptions | undefined, {dispatch}) => {
    await ensureDefaultDirs();
    const opts = options || {includeIPod: true, localDirs: [RNFS.DocumentDirectoryPath]};
    const includeIPod = opts.includeIPod !== false;
    const localDirs = opts.localDirs || (opts.localFiles?.length ? [] : [RNFS.DocumentDirectoryPath]);
    const localFiles = opts.localFiles || [];

    await logInfo(`Importing iOS: iPod=${includeIPod}, dirs=${localDirs.length}, files=${localFiles.length}`, 'importiOS');

    const allTracks: Track[] = [];
    const seenIds = new Set<string>();

    // 1. 尝试从 iTunes/iPod 媒体库导入
    const {MediaLibraryModule: MLModule} = require('react-native').NativeModules;
    let isSim = false;
    try {
      isSim = MLModule ? await MLModule.isSimulator() : false;
    } catch {}

    if (includeIPod && !isSim) {
      dispatch(setScanProgress({phase: 'scanning', current: 0, total: 2}));
      const permOk = await requestMediaLibraryPermission();
      if (permOk) {
        try {
          const mediaItems = await importFromMediaLibrary();
          for (const t of mediaItems) {
            if (!seenIds.has(t.id)) {
              seenIds.add(t.id);
              allTracks.push(t);
            }
          }
        } catch (e) {
          await logInfo(`Media library import failed: ${e}`, 'importiOS');
        }
      }
    }

    // 2. 扫描本地音乐目录
    if (localDirs.length > 0) {
      dispatch(setScanProgress({phase: 'scanning', current: 1, total: 2}));
      try {
        const localTracks = await scanAllMusic(localDirs, p => {
          if (p.phase === 'parsing') {
            dispatch(setScanProgress({phase: 'parsing', current: p.current, total: p.total + allTracks.length}));
          }
        });
        for (const t of localTracks) {
          if (!seenIds.has(t.id)) {
            seenIds.add(t.id);
            allTracks.push(t);
          }
        }
      } catch (e) {
        await logInfo(`Local dir scan failed: ${e}`, 'importiOS');
      }
    }

    // 3. 导入指定的本地文件
    if (localFiles.length > 0) {
      dispatch(setScanProgress({phase: 'parsing', current: 0, total: localFiles.length}));
      try {
        const {parseID3} = require('../utils/id3Parser');
        const {saveArtworkFile} = require('../utils/artworkCache');
        for (let i = 0; i < localFiles.length; i++) {
          const fp = localFiles[i];
          if (seenIds.has(fp)) continue;
          try {
            const fn = fp.substring(fp.lastIndexOf('/') + 1);
            const id3 = await parseID3(fp);
            const dotIdx = fp.lastIndexOf('.');
            const lrcPath = dotIdx > 0 ? fp.substring(0, dotIdx) + '.lrc' : undefined;
            const hasLrc = lrcPath && await RNFS.exists(lrcPath) ? lrcPath : undefined;
            let artworkUri: string | undefined;
            if (id3.artwork) artworkUri = await saveArtworkFile(fp, id3.artwork);
            const t: Track = {
              id: fp,
              url: `file://${fp}`,
              title: id3.title || (dotIdx > 0 ? fn.substring(0, fn.lastIndexOf('.')) : fn),
              artist: id3.artist || '未知歌手',
              album: id3.album || '未知专辑',
              artwork: artworkUri,
              fileName: fn,
              filePath: fp,
              isFavorite: false,
              lrcPath: hasLrc,
              embeddedLyrics: id3.lyrics,
            };
            seenIds.add(fp);
            allTracks.push(t);
          } catch {}
          dispatch(setScanProgress({phase: 'parsing', current: i + 1, total: localFiles.length}));
        }
      } catch (e) {
        await logInfo(`Local file import failed: ${e}`, 'importiOS');
      }
    }

    dispatch(setScanProgress({phase: 'parsing', current: allTracks.length, total: allTracks.length}));

    if (allTracks.length === 0) {
      throw new Error(
        isSim
          ? '模拟器无法访问媒体库。请将音乐文件放入 Documents 目录后重试'
          : '未找到音乐。\n1. 通过 iTunes/Finder 同步音乐到设备\n2. 或使用「文件」应用将音乐放入 ShellPlayer 的 Documents 目录',
      );
    }

    try {
      const lite = allTracks.map(t => ({
        ...t,
        artwork: t.artwork ? (t.artwork.startsWith('file://') ? t.artwork : '<<HAS>>') : undefined,
      }));
      await AsyncStorage.setItem('@trackCache', JSON.stringify(lite));
    } catch (e) {
      await logCrash(e instanceof Error ? e : new Error(String(e)), 'cache_ios');
    }
    const dirsList = [...(includeIPod ? ['ipod-library'] : []), ...localDirs];
    return {tracks: allTracks, directories: dirsList.length > 0 ? dirsList : [RNFS.DocumentDirectoryPath]};
  },
);

export const scanMusic = createAsyncThunk('music/scan', async (directories: string[], {dispatch}) => {
  await ensureDefaultDirs();
  await logInfo(`Scanning ${directories.length} dirs`, 'scanMusic');
  if (Platform.OS !== 'ios') {
    const ok = await requestStoragePermission();
    if (!ok) {
      throw new Error('没有存储权限，无法扫描音乐文件');
    }
  }
  const tracks = await scanAllMusic(directories, p => dispatch(setScanProgress(p)));
  try {
    const lite = tracks.map(t => ({
      ...t,
      artwork: t.artwork ? (t.artwork.startsWith('file://') ? t.artwork : '<<HAS>>') : undefined,
    }));
    await AsyncStorage.setItem('@trackCache', JSON.stringify(lite));
  } catch (e) {
    await logCrash(e instanceof Error ? e : new Error(String(e)), 'cache');
  }
  try {
    const withArt = tracks.filter(t => t.artwork && t.artwork.startsWith('data:'));
    for (let i = 0; i < withArt.length; i += 10) {
      await Promise.all(withArt.slice(i, i + 10).map(t => saveArtworkFile(t.id, t.artwork!)));
    }
  } catch {}
  return {tracks, directories};
});

export const loadCachedTracks = createAsyncThunk('music/loadCache', async () => {
  try {
    const data = await AsyncStorage.getItem('@trackCache');
    if (!data) {
      return [];
    }
    const cached = JSON.parse(data) as Track[];
    const tracks = cached.map(t => ({
      ...t,
      artwork: t.artwork === '<<HAS>>' ? undefined : t.artwork?.startsWith('file://') ? t.artwork : undefined,
    }));
    try {
      const noArt = tracks.filter(t => !t.artwork);
      if (noArt.length > 0) {
        const artMap = await batchGetCachedArtworks(noArt.map(t => t.id));
        for (const t of noArt) {
          const a = artMap.get(t.id);
          if (a) t.artwork = a;
        }
      }
    } catch {}
    return tracks;
  } catch {
    return [];
  }
});

export const loadFavorites = createAsyncThunk('music/loadFavorites', async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem('@favorites')) || '[]');
  } catch {
    return [];
  }
});
export const loadScanDirs = createAsyncThunk('music/loadScanDirs', async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem('@scanDirs')) || '[]');
  } catch {
    return [];
  }
});
export const loadHiddenTracks = createAsyncThunk('music/loadHidden', async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem('@hiddenTracks')) || '[]');
  } catch {
    return [];
  }
});
export const loadPlayHistory = createAsyncThunk('music/loadHistory', async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem('@playHistory')) || '[]');
  } catch {
    return [];
  }
});
export const loadUserPrefs = createAsyncThunk('music/loadPrefs', async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem('@userPrefs')) || '{}');
  } catch {
    return {};
  }
});

export const playTrack = createAsyncThunk('music/playTrack', async ({track, queue, shuffle}: {track: Track; queue: Track[]; shuffle?: boolean}, {dispatch, getState}) => {
  try {
    let idx = queue.findIndex(t => t.id === track.id);
    if (idx < 0) {
      idx = 0;
    }

    const start = Math.max(0, idx - 10);
    const end = Math.min(queue.length, idx + 11);
    const sub = queue.slice(start, end);
    const si = idx - start;

    try {
      await TrackPlayer.reset();
    } catch {
      await new Promise(r => setTimeout(r, 200));
      try {
        await TrackPlayer.reset();
      } catch {}
    }

    // 先导出并添加当前歌曲，立即开始播放
    const currentUrl = track.url.startsWith('ipod-library://') ? await exportTrackToFile(track.url) : track.url;
    await TrackPlayer.add({
      id: track.id,
      url: currentUrl,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
    });

    const state = getState() as {music: MusicState};
    try {
      await TrackPlayer.setRate(state.music.playbackSpeed);
    } catch {}
    await TrackPlayer.play();

    // 后台逐个导出并添加周围歌曲（避免并发导出导致 iOS "Operation Stopped"）
    const before = sub.slice(0, si).reverse();
    const after = sub.slice(si + 1);
    const addAfter = async () => {
      for (const t of after) {
        const u = t.url.startsWith('ipod-library://') ? await exportTrackToFile(t.url) : t.url;
        try {
          await TrackPlayer.add({id: t.id, url: u, title: t.title, artist: t.artist, artwork: t.artwork});
        } catch {}
      }
    };
    const addBefore = async () => {
      const items = [];
      for (const t of before) {
        const u = t.url.startsWith('ipod-library://') ? await exportTrackToFile(t.url) : t.url;
        items.unshift({id: t.id, url: u, title: t.title, artist: t.artist, artwork: t.artwork});
      }
      for (const item of items) {
        try {
          await TrackPlayer.add(item, 0);
        } catch {}
      }
    };
    addAfter();
    addBefore();

    try {
      let lyrLines: LyricLine[] = [];
      if (track.lrcPath) {
        lyrLines = parseLRC(await readLrcFile(track.lrcPath));
      } else if (track.embeddedLyrics) {
        lyrLines = parseLRC(track.embeddedLyrics);
        if (lyrLines.length === 0) {
          lyrLines = parseTextLyrics(track.embeddedLyrics, track.duration);
        }
      }
      // iOS: 如果没有歌词，通过 AVURLAsset 从音频文件直接读取内嵌歌词
      if (lyrLines.length === 0 && Platform.OS === 'ios' && track.url) {
        const nativeLyrics = await getLyricsForUrl(track.url);
        if (nativeLyrics) {
          lyrLines = parseLRC(nativeLyrics);
          if (lyrLines.length === 0) {
            lyrLines = parseTextLyrics(nativeLyrics, track.duration);
          }
        }
      }
      // Fallback: search the default lrc directory for a matching .lrc file
      if (lyrLines.length === 0) {
        const lrcDir = getDefaultLrcDir();
        const matchedLrc = await findMatchingLrcInDir(track, lrcDir);
        if (matchedLrc) {
          lyrLines = parseLRC(await readLrcFile(matchedLrc));
        }
      }
      dispatch(setLyrics(lyrLines));
    } catch {
      dispatch(setLyrics([]));
    }

    // Add to play history
    dispatch(addToHistory(track.id));

    // Store play queue
    dispatch(setPlayQueue(queue));

    return {track, index: idx};
  } catch (err) {
    await logCrash(err instanceof Error ? err : new Error(String(err)), 'playTrack');
    return {track, index: 0};
  }
});

export const deleteTrackPermanently = createAsyncThunk('music/deletePermanent', async (id: string) => {
  try {
    if (await RNFS.exists(id)) {
      await RNFS.unlink(id);
    }
    const dot = id.lastIndexOf('.');
    if (dot > 0) {
      const lrc = id.substring(0, dot) + '.lrc';
      if (await RNFS.exists(lrc)) {
        await RNFS.unlink(lrc);
      }
    }
  } catch {}
  return id;
});

// --- Slice ---

const musicSlice = createSlice({
  name: 'music',
  initialState,
  reducers: {
    setCurrentTrack: (s, a: PayloadAction<Track | null>) => {
      s.currentTrack = a.payload;
    },
    setIsPlaying: (s, a: PayloadAction<boolean>) => {
      s.isPlaying = a.payload;
    },
    setLyrics: (s, a: PayloadAction<LyricLine[]>) => {
      s.lyrics = a.payload;
      s.currentLyricIndex = -1;
    },
    setCurrentLyricIndex: (s, a: PayloadAction<number>) => {
      s.currentLyricIndex = a.payload;
    },
    setShowFullPlayer: (s, a: PayloadAction<boolean>) => {
      s.showFullPlayer = a.payload;
    },
    toggleShowLyrics: s => {
      s.showLyrics = !s.showLyrics;
    },
    setRepeatMode: (s, a: PayloadAction<RepeatMode>) => {
      s.repeatMode = a.payload;
    },
    toggleFavorite: (s, a: PayloadAction<string>) => {
      const id = a.payload;
      const idx = s.favoriteIds.indexOf(id);
      if (idx >= 0) {
        s.favoriteIds.splice(idx, 1);
      } else {
        s.favoriteIds.push(id);
      }
      const t = s.tracks.find(x => x.id === id);
      if (t) {
        t.isFavorite = idx < 0;
      }
    },
    setCurrentIndex: (s, a: PayloadAction<number>) => {
      s.currentIndex = a.payload;
    },
    setSearchQuery: (s, a: PayloadAction<string>) => {
      s.searchQuery = a.payload;
    },
    setScanDirectories: (s, a: PayloadAction<string[]>) => {
      s.scanDirectories = a.payload;
    },
    setScanProgress: (s, a: PayloadAction<ScanProgress | null>) => {
      s.scanProgress = a.payload;
    },
    hideTrack: (s, a: PayloadAction<string>) => {
      const id = a.payload;
      if (!s.hiddenTrackIds.includes(id)) {
        s.hiddenTrackIds.push(id);
      }
      s.tracks = s.tracks.filter(t => t.id !== id);
    },
    // Sort
    setSortMode: (s, a: PayloadAction<SortMode>) => {
      s.sortMode = a.payload;
    },
    setThemeMode: (s, a: PayloadAction<ThemeMode>) => {
      s.themeMode = a.payload;
    },
    // Play history
    addToHistory: (s, a: PayloadAction<string>) => {
      const entry: PlayHistoryEntry = {trackId: a.payload, playedAt: Date.now()};
      s.playHistory = [entry, ...s.playHistory.filter(h => h.trackId !== a.payload)].slice(0, 100);
    },
    clearHistory: s => {
      s.playHistory = [];
    },
    // Playback speed
    setPlaybackSpeed: (s, a: PayloadAction<number>) => {
      s.playbackSpeed = a.payload;
    },
    // Sleep timer
    setSleepTimer: (s, a: PayloadAction<number | null>) => {
      s.sleepTimerEnd = a.payload;
    },
    // Play queue
    setPlayQueue: (s, a: PayloadAction<Track[]>) => {
      s.playQueue = a.payload;
    },
    // Batch select
    toggleBatchMode: s => {
      s.batchSelectMode = !s.batchSelectMode;
      if (!s.batchSelectMode) {
        s.batchSelectedIds = [];
      }
    },
    toggleBatchSelect: (s, a: PayloadAction<string>) => {
      const id = a.payload;
      const idx = s.batchSelectedIds.indexOf(id);
      if (idx >= 0) {
        s.batchSelectedIds.splice(idx, 1);
      } else {
        s.batchSelectedIds.push(id);
      }
    },
    batchFavorite: s => {
      for (const id of s.batchSelectedIds) {
        if (!s.favoriteIds.includes(id)) {
          s.favoriteIds.push(id);
        }
        const t = s.tracks.find(x => x.id === id);
        if (t) {
          t.isFavorite = true;
        }
      }
      s.batchSelectMode = false;
      s.batchSelectedIds = [];
    },
    batchHide: s => {
      for (const id of s.batchSelectedIds) {
        if (!s.hiddenTrackIds.includes(id)) {
          s.hiddenTrackIds.push(id);
        }
      }
      s.tracks = s.tracks.filter(t => !s.batchSelectedIds.includes(t.id));
      s.batchSelectMode = false;
      s.batchSelectedIds = [];
    },
    selectAllBatch: s => {
      s.batchSelectedIds = s.tracks.map(t => t.id);
    },
    clearBatchSelect: s => {
      s.batchSelectedIds = [];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(scanMusic.pending, s => {
        s.isScanning = true;
        s.scanError = null;
        s.scanProgress = null;
        s.hiddenTrackIds = [];
      })
      .addCase(scanMusic.fulfilled, (s, a) => {
        s.isScanning = false;
        s.scanProgress = null;
        const existingIds = new Set(s.tracks.map(t => t.id));
        const newTracks = a.payload.tracks.filter(t => !existingIds.has(t.id));
        for (const t of newTracks) {
          t.isFavorite = s.favoriteIds.includes(t.id);
        }
        s.tracks = [...s.tracks, ...newTracks];
        s.scanDirectories = a.payload.directories;
      })
      .addCase(scanMusic.rejected, (s, a) => {
        s.isScanning = false;
        s.scanProgress = null;
        s.scanError = a.error.message || '扫描失败';
      })
      .addCase(importiOSMediaLibrary.pending, s => {
        s.isScanning = true;
        s.scanError = null;
        s.scanProgress = null;
        s.hiddenTrackIds = [];
      })
      .addCase(importiOSMediaLibrary.fulfilled, (s, a) => {
        s.isScanning = false;
        s.scanProgress = null;
        const existingIds = new Set(s.tracks.map(t => t.id));
        const newTracks = a.payload.tracks.filter(t => !existingIds.has(t.id));
        for (const t of newTracks) {
          t.isFavorite = s.favoriteIds.includes(t.id);
        }
        s.tracks = [...s.tracks, ...newTracks];
        s.scanDirectories = a.payload.directories;
      })
      .addCase(importiOSMediaLibrary.rejected, (s, a) => {
        s.isScanning = false;
        s.scanProgress = null;
        s.scanError = a.error.message || '导入失败';
      })
      .addCase(loadCachedTracks.fulfilled, (s, a) => {
        if (a.payload.length > 0 && s.tracks.length === 0) {
          s.tracks = a.payload.filter(t => !s.hiddenTrackIds.includes(t.id));
          for (const t of s.tracks) {
            t.isFavorite = s.favoriteIds.includes(t.id);
          }
        }
      })
      .addCase(loadFavorites.fulfilled, (s, a) => {
        s.favoriteIds = a.payload;
        for (const t of s.tracks) {
          t.isFavorite = s.favoriteIds.includes(t.id);
        }
      })
      .addCase(loadScanDirs.fulfilled, (s, a) => {
        s.scanDirectories = a.payload;
      })
      .addCase(loadHiddenTracks.fulfilled, (s, a) => {
        s.hiddenTrackIds = a.payload;
      })
      .addCase(loadPlayHistory.fulfilled, (s, a) => {
        s.playHistory = a.payload;
      })
      .addCase(loadUserPrefs.fulfilled, (s, a) => {
        const p = a.payload as any;
        if (p.sortMode) {
          s.sortMode = p.sortMode;
        }
        if (p.themeMode) {
          s.themeMode = p.themeMode;
        }
        if (p.speed) {
          s.playbackSpeed = p.speed;
        }
      })
      .addCase(playTrack.fulfilled, (s, a) => {
        s.currentTrack = a.payload.track;
        s.currentIndex = a.payload.index;
        s.isPlaying = true;
      })
      .addCase(deleteTrackPermanently.fulfilled, (s, a) => {
        s.tracks = s.tracks.filter(t => t.id !== a.payload);
      });
  },
});

export const {
  setCurrentTrack,
  setIsPlaying,
  setLyrics,
  setCurrentLyricIndex,
  setShowFullPlayer,
  toggleShowLyrics,
  setRepeatMode,
  toggleFavorite,
  setCurrentIndex,
  setSearchQuery,
  setScanDirectories,
  setScanProgress,
  hideTrack,
  setSortMode,
  setThemeMode,
  addToHistory,
  clearHistory,
  setPlaybackSpeed,
  setSleepTimer,
  setPlayQueue,
  toggleBatchMode,
  toggleBatchSelect,
  batchFavorite,
  batchHide,
  selectAllBatch,
  clearBatchSelect,
} = musicSlice.actions;
export default musicSlice.reducer;
