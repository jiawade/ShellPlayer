// src/store/musicSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';
import RNFS from 'react-native-fs';
import { Track, LyricLine, RepeatMode, SortMode, ThemeMode, PlayHistoryEntry } from '../types';
import { scanAllMusic, readLrcFile, findMatchingLrcInDir, ScanProgress } from '../utils/scanner';
import { parseLRC, parseTextLyrics } from '../utils/lrcParser';
import { getDefaultLrcDir, getDefaultMusicDir, ensureDefaultDirs } from '../utils/defaultDirs';
import { requestStoragePermission } from '../utils/permissions';
import { SUPPORTED_FORMATS } from '../utils/theme';
import { logCrash, logInfo } from '../utils/crashLogger';
import { saveArtworkFile, batchGetCachedArtworks } from '../utils/artworkCache';
import {
  importFromMediaLibrary,
  requestMediaLibraryPermission,
  exportTrackToFile,
  getLyricsForUrl,
} from '../utils/mediaLibrary';

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
  hideDuplicates: boolean;
  batchSelectMode: boolean;
  batchSelectedIds: string[];
  customAccent: string | null;
  language: string;
  lyricsOffset: number; // seconds, per-track offset for lyrics sync
  playbackErrorMsg: string | null;
  shuffleHistory: string[]; // ordered track IDs for shuffle navigation
  shuffleHistoryIndex: number; // cursor position in shuffleHistory (-1 = empty)
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
  hideDuplicates: false,
  batchSelectMode: false,
  batchSelectedIds: [],
  customAccent: null,
  language: '',
  lyricsOffset: 0,
  playbackErrorMsg: null as string | null,
  shuffleHistory: [],
  shuffleHistoryIndex: -1,
};

const serializeArtworkForCache = (artwork?: string): string | undefined => {
  if (!artwork) return undefined;
  // Base64 artwork is too large for persisted store; keep a placeholder only for this case.
  return artwork.startsWith('data:') ? '<<HAS>>' : artwork;
};

// --- Async thunks ---

export interface IOSImportOptions {
  includeIPod?: boolean;
  localDirs?: string[];
  localFiles?: string[];
}

export const importiOSMediaLibrary = createAsyncThunk(
  'music/importiOS',
  async (options: IOSImportOptions | undefined, { dispatch }) => {
    await ensureDefaultDirs();
    const opts = options || { includeIPod: true, localDirs: [RNFS.DocumentDirectoryPath] };
    const includeIPod = opts.includeIPod !== false;
    const localDirs =
      opts.localDirs || (opts.localFiles?.length ? [] : [RNFS.DocumentDirectoryPath]);
    const localFiles = opts.localFiles || [];

    await logInfo(
      `Importing iOS: iPod=${includeIPod}, dirs=${localDirs.length}, files=${localFiles.length}`,
      'importiOS',
    );

    const allTracks: Track[] = [];
    const seenIds = new Set<string>();

    // 1. 尝试从 iTunes/iPod 媒体库导入
    const { MediaLibraryModule: MLModule } = require('react-native').NativeModules;
    let isSim = false;
    try {
      isSim = MLModule ? await MLModule.isSimulator() : false;
    } catch {}

    if (includeIPod && !isSim) {
      dispatch(setScanProgress({ phase: 'scanning', current: 0, total: 2 }));
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
      dispatch(setScanProgress({ phase: 'scanning', current: 1, total: 2 }));
      try {
        const localTracks = await scanAllMusic(localDirs, p => {
          if (p.phase === 'parsing') {
            dispatch(
              setScanProgress({
                phase: 'parsing',
                current: p.current,
                total: p.total + allTracks.length,
              }),
            );
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
      dispatch(setScanProgress({ phase: 'parsing', current: 0, total: localFiles.length }));
      try {
        const { parseID3 } = require('../utils/id3Parser');
        const { saveArtworkFile } = require('../utils/artworkCache');
        for (let i = 0; i < localFiles.length; i++) {
          const fp = localFiles[i];
          if (seenIds.has(fp)) continue;
          try {
            const fn = fp.substring(fp.lastIndexOf('/') + 1);
            const id3 = await parseID3(fp);
            const dotIdx = fp.lastIndexOf('.');
            const lrcPath = dotIdx > 0 ? fp.substring(0, dotIdx) + '.lrc' : undefined;
            const hasLrc = lrcPath && (await RNFS.exists(lrcPath)) ? lrcPath : undefined;
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
          dispatch(setScanProgress({ phase: 'parsing', current: i + 1, total: localFiles.length }));
        }
      } catch (e) {
        await logInfo(`Local file import failed: ${e}`, 'importiOS');
      }
    }

    dispatch(
      setScanProgress({ phase: 'parsing', current: allTracks.length, total: allTracks.length }),
    );

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
        artwork: serializeArtworkForCache(t.artwork),
      }));
      await AsyncStorage.setItem('@trackCache', JSON.stringify(lite));
    } catch (e) {
      await logCrash(e instanceof Error ? e : new Error(String(e)), 'cache_ios');
    }
    const dirsList = [...(includeIPod ? ['ipod-library'] : []), ...localDirs];
    return {
      tracks: allTracks,
      directories: dirsList.length > 0 ? dirsList : [RNFS.DocumentDirectoryPath],
    };
  },
);

export const scanMusic = createAsyncThunk(
  'music/scan',
  async (directories: string[], { dispatch }) => {
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
        artwork: serializeArtworkForCache(t.artwork),
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
    return { tracks, directories };
  },
);

export const loadCachedTracks = createAsyncThunk('music/loadCache', async () => {
  try {
    const data = await AsyncStorage.getItem('@trackCache');
    if (!data) {
      return [];
    }
    const cached = JSON.parse(data) as Track[];
    // Filter out any tracks with unsupported/encrypted formats.
    const normalized: Track[] = cached
      .filter(t => {
        const ext = t.fileName?.substring(t.fileName.lastIndexOf('.')).toLowerCase() || '';
        // iPod library tracks may not have a normal extension — keep them
        if (!ext || t.url?.startsWith('ipod-library://')) return true;
        return SUPPORTED_FORMATS.includes(ext);
      })
      .map(t =>
        t.artwork === '<<HAS>>'
          ? {
              ...t,
              artwork: undefined,
            }
          : t,
      );

    // Drop local-file records that no longer exist on disk (e.g. deleted outside app or restored stale cache).
    const checked = await Promise.all(
      normalized.map(async t => {
        if (t.url?.startsWith('ipod-library://')) return t;

        const shouldCheckLocalFile =
          t.filePath?.startsWith('/') || t.url?.startsWith('file://') || t.id.startsWith('/');
        if (!shouldCheckLocalFile) return t;

        const localPath = t.filePath || (t.url?.startsWith('file://') ? t.url.replace('file://', '') : t.id);
        if (!localPath) return null;

        try {
          return (await RNFS.exists(localPath)) ? t : null;
        } catch {
          return null;
        }
      }),
    );

    const playable = checked.filter((t): t is Track => t !== null);
    if (playable.length !== normalized.length) {
      const lite = playable.map(t => ({
        ...t,
        artwork: serializeArtworkForCache(t.artwork),
      }));
      await AsyncStorage.setItem('@trackCache', JSON.stringify(lite));
    }

    return playable;
  } catch {
    return [];
  }
});

// 后台修复封面：不阻塞歌曲列表显示
export const repairCachedArtwork = createAsyncThunk(
  'music/repairArtwork',
  async (_: void, { getState }) => {
    const state = getState() as { music: MusicState };
    const tracks = state.music.tracks;
    if (tracks.length === 0) return {} as Record<string, string>;

    const updates: Record<string, string> = {};
    let noArtIds: Set<string>;

    // 1. 验证现有 file:// 封面是否存在
    try {
      const fileArtTracks = tracks.filter(t => t.artwork?.startsWith('file://'));
      const invalidIds: string[] = [];
      await Promise.all(
        fileArtTracks.map(async t => {
          const path = t.artwork!.replace('file://', '');
          if (!(await RNFS.exists(path))) invalidIds.push(t.id);
        }),
      );
      noArtIds = new Set([...tracks.filter(t => !t.artwork).map(t => t.id), ...invalidIds]);
    } catch {
      noArtIds = new Set(tracks.filter(t => !t.artwork).map(t => t.id));
    }
    if (noArtIds.size === 0) return updates;

    // 2. 从封面缓存目录批量恢复
    try {
      const artMap = await batchGetCachedArtworks(Array.from(noArtIds));
      for (const [id, uri] of artMap) {
        updates[id] = uri;
        noArtIds.delete(id);
      }
    } catch {}

    // 3. iOS: 从媒体库恢复封面
    try {
      if (Platform.OS === 'ios' && noArtIds.size > 0) {
        const mediaTracks = await importFromMediaLibrary();
        const byId = new Map(mediaTracks.map(m => [m.id, m]));
        const byUrl = new Map(mediaTracks.map(m => [m.url, m]));

        for (const t of tracks) {
          if (!noArtIds.has(t.id)) continue;
          const m = byId.get(t.id) || byUrl.get(t.url);
          if (!m?.artwork) continue;
          if (m.artwork.startsWith('file://')) {
            updates[t.id] = m.artwork;
            noArtIds.delete(t.id);
          } else if (m.artwork.startsWith('data:')) {
            const saved = await saveArtworkFile(t.id, m.artwork);
            if (saved) {
              updates[t.id] = saved;
              noArtIds.delete(t.id);
            }
          } else {
            updates[t.id] = m.artwork;
            noArtIds.delete(t.id);
          }
        }
      }
    } catch {}

    // 4. 本地 ID3 补偿
    try {
      const unresolvedLocal = tracks.filter(t => noArtIds.has(t.id) && !!t.filePath);
      if (unresolvedLocal.length > 0) {
        const { parseID3 } = require('../utils/id3Parser');
        for (const t of unresolvedLocal) {
          try {
            if (!(await RNFS.exists(t.filePath))) continue;
            const id3 = await parseID3(t.filePath);
            if (!id3?.artwork) continue;
            const saved = await saveArtworkFile(t.id, id3.artwork);
            if (saved) {
              updates[t.id] = saved;
              noArtIds.delete(t.id);
            }
          } catch {}
        }
      }
    } catch {}

    // 5. 回写缓存
    if (Object.keys(updates).length > 0) {
      try {
        const data = await AsyncStorage.getItem('@trackCache');
        if (data) {
          const cached = JSON.parse(data) as Track[];
          for (const t of cached) {
            if (updates[t.id]) t.artwork = serializeArtworkForCache(updates[t.id]);
          }
          await AsyncStorage.setItem('@trackCache', JSON.stringify(cached));
        }
      } catch {}
    }

    return updates;
  },
);
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

export const loadLastPlayback = createAsyncThunk('music/loadLastPlayback', async () => {
  try {
    const raw = await AsyncStorage.getItem('@lastPlayback');
    if (!raw) return null;
    return JSON.parse(raw) as { trackId: string; position: number };
  } catch {
    return null;
  }
});

// Generation counter to cancel stale background queue-add tasks
let playTrackGeneration = 0;

export const playTrack = createAsyncThunk(
  'music/playTrack',
  async (
    {
      track,
      queue,
      shuffle: _shuffle,
      navigatingShuffleHistory,
    }: { track: Track; queue: Track[]; shuffle?: boolean; navigatingShuffleHistory?: boolean },
    { dispatch, getState },
  ) => {
    try {
      const gen = ++playTrackGeneration;

      const localPath =
        track.filePath || (track.url?.startsWith('file://') ? track.url.replace('file://', '') : track.id);
      const isLocalTrack =
        !!localPath &&
        (track.filePath?.startsWith('/') || track.url?.startsWith('file://') || track.id.startsWith('/'));
      if (isLocalTrack && !(await RNFS.exists(localPath))) {
        dispatch(removeUnplayableTrack(track.id));
        dispatch(setPlaybackErrorMsg('文件不存在，已从列表移除'));
        throw new Error('Track file does not exist');
      }

      const ext = track.fileName?.substring(track.fileName.lastIndexOf('.')).toLowerCase() || '';

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
      const currentUrl = track.url.startsWith('ipod-library://')
        ? await exportTrackToFile(track.url)
        : track.url;
      if (gen !== playTrackGeneration) return { track, index: idx };
      await TrackPlayer.add({
        id: track.id,
        url: currentUrl,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
      });

      const state = getState() as { music: MusicState };
      try {
        await TrackPlayer.setRate(state.music.playbackSpeed);
      } catch {}
      await TrackPlayer.play();

      // 后台逐个导出并添加周围歌曲（串行执行，避免并发操作导致队列竞态）
      const before = sub.slice(0, si);
      const after = sub.slice(si + 1);
      const addSurrounding = async () => {
        // 先添加后续歌曲（追加到队尾，无需指定索引）
        for (const t of after) {
          if (gen !== playTrackGeneration) return;
          const u = t.url.startsWith('ipod-library://') ? await exportTrackToFile(t.url) : t.url;
          if (gen !== playTrackGeneration) return;
          try {
            await TrackPlayer.add({
              id: t.id,
              url: u,
              title: t.title,
              artist: t.artist,
              artwork: t.artwork,
            });
          } catch {}
        }
        // 再添加前面的歌曲（从最远的开始，逐个插入到队首，保持正确顺序）
        for (let i = before.length - 1; i >= 0; i--) {
          if (gen !== playTrackGeneration) return;
          const t = before[i];
          const u = t.url.startsWith('ipod-library://') ? await exportTrackToFile(t.url) : t.url;
          if (gen !== playTrackGeneration) return;
          try {
            await TrackPlayer.add(
              { id: t.id, url: u, title: t.title, artist: t.artist, artwork: t.artwork },
              0,
            );
          } catch {}
        }
      };
      addSurrounding();

      try {
        let lyrLines: LyricLine[] = [];
        // Priority 1: 内置歌词（ID3 标签中的歌词）
        if (track.embeddedLyrics) {
          lyrLines = parseLRC(track.embeddedLyrics);
          if (lyrLines.length === 0) {
            lyrLines = parseTextLyrics(track.embeddedLyrics, track.duration);
          }
        }
        // iOS: 通过 AVURLAsset 从音频文件直接读取内嵌歌词
        if (lyrLines.length === 0 && Platform.OS === 'ios' && track.url) {
          const nativeLyrics = await getLyricsForUrl(track.url);
          if (nativeLyrics) {
            lyrLines = parseLRC(nativeLyrics);
            if (lyrLines.length === 0) {
              lyrLines = parseTextLyrics(nativeLyrics, track.duration);
            }
          }
        }
        // Priority 2: lrc 目录中匹配的 .lrc 文件
        if (lyrLines.length === 0) {
          const lrcDir = getDefaultLrcDir();
          const matchedLrc = await findMatchingLrcInDir(track, lrcDir);
          if (matchedLrc) {
            lyrLines = parseLRC(await readLrcFile(matchedLrc));
          }
        }
        // Priority 3: music 目录中匹配的 .lrc 文件
        if (lyrLines.length === 0) {
          if (track.lrcPath) {
            lyrLines = parseLRC(await readLrcFile(track.lrcPath));
          }
          if (lyrLines.length === 0) {
            const musicDir = getDefaultMusicDir();
            const matchedLrc = await findMatchingLrcInDir(track, musicDir);
            if (matchedLrc) {
              lyrLines = parseLRC(await readLrcFile(matchedLrc));
            }
          }
        }
        dispatch(setLyrics(lyrLines));
      } catch {
        dispatch(setLyrics([]));
      }

      // Add to play history
      dispatch(addToHistory(track.id));

      // Push to shuffle navigation history (if in shuffle mode and not navigating back/forward)
      const currentState = getState() as { music: MusicState };
      if (currentState.music.repeatMode === 'queue' && !navigatingShuffleHistory) {
        dispatch(pushShuffleHistory(track.id));
      }

      // Store play queue
      dispatch(setPlayQueue(queue));

      return { track, index: idx };
    } catch (err) {
      await logCrash(err instanceof Error ? err : new Error(String(err)), 'playTrack');
      throw err;
    }
  },
);

export const deleteTrackPermanently = createAsyncThunk(
  'music/deletePermanent',
  async (id: string) => {
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
  },
);

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
    setLyricsOffset: (s, a: PayloadAction<number>) => {
      s.lyricsOffset = a.payload;
    },
    setShowFullPlayer: (s, a: PayloadAction<boolean>) => {
      s.showFullPlayer = a.payload;
    },
    toggleShowLyrics: s => {
      s.showLyrics = !s.showLyrics;
    },
    setRepeatMode: (s, a: PayloadAction<RepeatMode>) => {
      const wasShuffleMode = s.repeatMode === 'queue';
      s.repeatMode = a.payload;
      if (a.payload === 'queue' && s.currentTrack) {
        // Entering shuffle mode: init history with current track
        s.shuffleHistory = [s.currentTrack.id];
        s.shuffleHistoryIndex = 0;
      } else if (wasShuffleMode) {
        // Leaving shuffle mode: clear history
        s.shuffleHistory = [];
        s.shuffleHistoryIndex = -1;
      }
    },
    toggleFavorite: (s, a: PayloadAction<string>) => {
      const id = a.payload;
      const idx = s.favoriteIds.indexOf(id);
      if (idx >= 0) {
        s.favoriteIds.splice(idx, 1);
      } else {
        s.favoriteIds.push(id);
      }
      const isFav = idx < 0;
      const t = s.tracks.find(x => x.id === id);
      if (t) {
        t.isFavorite = isFav;
      }
      if (s.currentTrack && s.currentTrack.id === id) {
        s.currentTrack.isFavorite = isFav;
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
    // Remove track from lists without hiding (allows re-import)
    removeUnplayableTrack: (s, a: PayloadAction<string>) => {
      const id = a.payload;
      s.tracks = s.tracks.filter(t => t.id !== id);
      s.playQueue = s.playQueue.filter(t => t.id !== id);
    },
    // Sort
    setSortMode: (s, a: PayloadAction<SortMode>) => {
      s.sortMode = a.payload;
    },
    setThemeMode: (s, a: PayloadAction<ThemeMode>) => {
      s.themeMode = a.payload;
    },
    setLanguage: (s, a: PayloadAction<string>) => {
      s.language = a.payload;
    },
    // Play history
    addToHistory: (s, a: PayloadAction<string>) => {
      const entry: PlayHistoryEntry = { trackId: a.payload, playedAt: Date.now() };
      s.playHistory = [entry, ...s.playHistory.filter(h => h.trackId !== a.payload)].slice(0, 100);
    },
    clearHistory: s => {
      s.playHistory = [];
    },
    // Shuffle navigation history
    pushShuffleHistory: (s, a: PayloadAction<string>) => {
      // Trim any "future" entries (e.g. user went back then plays a new track)
      s.shuffleHistory = s.shuffleHistory.slice(0, s.shuffleHistoryIndex + 1);
      s.shuffleHistory.push(a.payload);
      s.shuffleHistoryIndex = s.shuffleHistory.length - 1;
      // Limit total size
      if (s.shuffleHistory.length > 200) {
        const excess = s.shuffleHistory.length - 200;
        s.shuffleHistory = s.shuffleHistory.slice(excess);
        s.shuffleHistoryIndex -= excess;
      }
    },
    shuffleHistoryBack: s => {
      if (s.shuffleHistoryIndex > 0) {
        s.shuffleHistoryIndex--;
      }
    },
    prependShuffleHistory: (s, a: PayloadAction<string>) => {
      s.shuffleHistory.unshift(a.payload);
      // index stays at 0 → now points to the newly prepended track
    },
    shuffleHistoryForward: s => {
      if (s.shuffleHistoryIndex < s.shuffleHistory.length - 1) {
        s.shuffleHistoryIndex++;
      }
    },
    // Playback speed
    setPlaybackSpeed: (s, a: PayloadAction<number>) => {
      s.playbackSpeed = a.payload;
    },
    setPlaybackErrorMsg: (s, a: PayloadAction<string | null>) => {
      s.playbackErrorMsg = a.payload;
    },
    // Sleep timer
    setSleepTimer: (s, a: PayloadAction<number | null>) => {
      s.sleepTimerEnd = a.payload;
    },
    // Hide duplicates
    setHideDuplicates: (s, a: PayloadAction<boolean>) => {
      s.hideDuplicates = a.payload;
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
    setCustomAccent: (s, a: PayloadAction<string | null>) => {
      s.customAccent = a.payload;
    },
    updateTrackMetadata(
      s,
      a: PayloadAction<{
        trackId: string;
        changes: Partial<Pick<Track, 'title' | 'artist' | 'album'>>;
      }>,
    ) {
      const { trackId, changes } = a.payload;
      const track = s.tracks.find(t => t.id === trackId);
      if (track) Object.assign(track, changes);
      if (s.currentTrack?.id === trackId) Object.assign(s.currentTrack, changes);
    },
    updateTrackArtwork(s, a: PayloadAction<{ trackId: string; artwork: string }>) {
      const { trackId, artwork } = a.payload;
      const track = s.tracks.find(t => t.id === trackId);
      if (track) track.artwork = artwork;
      if (s.currentTrack?.id === trackId) s.currentTrack.artwork = artwork;
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
      .addCase(repairCachedArtwork.fulfilled, (s, a) => {
        const updates = a.payload;
        if (Object.keys(updates).length > 0) {
          for (const t of s.tracks) {
            if (updates[t.id]) t.artwork = updates[t.id];
          }
          // Update lock screen artwork for currently playing track
          if (s.currentTrack && updates[s.currentTrack.id]) {
            s.currentTrack.artwork = updates[s.currentTrack.id];
            const artwork = updates[s.currentTrack.id];
            TrackPlayer.updateMetadataForTrack(
              s.tracks.findIndex(t => t.id === s.currentTrack!.id),
              { artwork },
            ).catch(() => {});
            // Include elapsed time to prevent stale elapsedPlaybackTime from resetting lock screen progress
            TrackPlayer.getProgress()
              .then(({ position }) => {
                TrackPlayer.updateNowPlayingMetadata({ artwork, elapsedTime: position }).catch(
                  () => {},
                );
              })
              .catch(() => {});
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
        if (['title', 'artist', 'album', 'duration', 'recent', 'shuffle'].includes(p.sortMode)) {
          s.sortMode = p.sortMode;
        }
        if (p.themeMode) {
          s.themeMode = p.themeMode;
        }
        if (p.speed) {
          s.playbackSpeed = p.speed;
        }
        if (typeof p.hideDuplicates === 'boolean') {
          s.hideDuplicates = p.hideDuplicates;
        }
        if (p.customAccent !== undefined) {
          s.customAccent = p.customAccent;
        }
        if (p.language) {
          s.language = p.language;
        }
      })
      .addCase(playTrack.pending, (s, a) => {
        s.currentTrack = a.meta.arg.track;
        s.currentIndex = a.meta.arg.queue.findIndex(t => t.id === a.meta.arg.track.id);
      })
      .addCase(playTrack.fulfilled, (s, a) => {
        s.currentTrack = a.payload.track;
        s.currentIndex = a.payload.index;
        s.isPlaying = true;
      })
      .addCase(playTrack.rejected, s => {
        s.isPlaying = false;
      })
      .addCase(deleteTrackPermanently.fulfilled, (s, a) => {
        s.tracks = s.tracks.filter(t => t.id !== a.payload);
        s.playQueue = s.playQueue.filter(t => t.id !== a.payload);
        if (s.currentTrack?.id === a.payload) {
          s.currentTrack = null;
          s.currentIndex = -1;
          s.isPlaying = false;
        }
      });
  },
});

export const {
  setCurrentTrack,
  setIsPlaying,
  setLyrics,
  setCurrentLyricIndex,
  setLyricsOffset,
  setShowFullPlayer,
  toggleShowLyrics,
  setRepeatMode,
  toggleFavorite,
  setCurrentIndex,
  setSearchQuery,
  setScanDirectories,
  setScanProgress,
  hideTrack,
  removeUnplayableTrack,
  setSortMode,
  setThemeMode,
  addToHistory,
  clearHistory,
  pushShuffleHistory,
  prependShuffleHistory,
  shuffleHistoryBack,
  shuffleHistoryForward,
  setPlaybackSpeed,
  setSleepTimer,
  setPlayQueue,
  setHideDuplicates,
  toggleBatchMode,
  toggleBatchSelect,
  batchFavorite,
  batchHide,
  selectAllBatch,
  clearBatchSelect,
  setCustomAccent,
  setLanguage,
  updateTrackMetadata,
  updateTrackArtwork,
  setPlaybackErrorMsg,
} = musicSlice.actions;
export default musicSlice.reducer;
