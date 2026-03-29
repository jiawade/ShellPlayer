// src/hooks/usePlayerProgress.ts
import { useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import TrackPlayer, {
  useProgress,
  usePlaybackState,
  useActiveTrack,
  State,
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setIsPlaying,
  setCurrentTrack,
  setCurrentLyricIndex,
  setLyrics,
  setCurrentIndex,
  playTrack,
  shuffleHistoryBack,
  shuffleHistoryForward,
  prependShuffleHistory,
} from '../store/musicSlice';
import { recordListenTime } from '../store/statsSlice';
import { findCurrentLyricIndex, parseLRC, parseTextLyrics } from '../utils/lrcParser';
import { readLrcFile, findMatchingLrcInDir } from '../utils/scanner';
import { getLyricsForUrl } from '../utils/mediaLibrary';
import { getDefaultLrcDir } from '../utils/defaultDirs';
import {
  isBluetoothLyricsEnabled,
  setOriginalTrackInfo,
  pushLyricToNowPlaying,
  restoreOriginalMetadata,
} from '../utils/bluetoothLyrics';
import { updateLiveActivity, stopLiveActivity, isLiveActivityActive } from '../utils/liveActivity';
import {
  useVlcSnapshot,
  pauseVlc,
  resumeVlc,
  seekVlc,
  getVlcSnapshot,
} from '../utils/vlcPlayback';
import { shouldUseVlcForTrack } from '../utils/vlcFormats';

export function usePlayerSync() {
  const dispatch = useAppDispatch();
  const tpProgress = useProgress(200);
  const vlcSnapshot = useVlcSnapshot();
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const { lyrics, tracks, currentTrack, activePlayer } = useAppSelector(s => s.music);
  const position = activePlayer === 'vlc' ? vlcSnapshot.position : tpProgress.position;
  const duration = activePlayer === 'vlc' ? vlcSnapshot.duration : tpProgress.duration;
  const lastLyricIdx = useRef(-1);
  const prevPosition = useRef(0);
  const listenAccum = useRef(0);
  const lastTickTime = useRef(0);
  const prevTrackId = useRef<string | undefined>(undefined);
  const currentTrackIdRef = useRef(currentTrack?.id);
  currentTrackIdRef.current = currentTrack?.id;

  useEffect(() => {
    const playing =
      activePlayer === 'vlc'
        ? vlcSnapshot.isPlaying
        : playbackState.state === State.Playing || playbackState.state === State.Buffering;
    dispatch(setIsPlaying(playing));
  }, [activePlayer, vlcSnapshot.isPlaying, playbackState.state, dispatch]);

  // Flush accumulated listen time when track changes
  useEffect(() => {
    const activeTrackId = activePlayer === 'vlc' ? currentTrack?.id : activeTrack?.id;
    if (activeTrackId !== prevTrackId.current) {
      if (prevTrackId.current && listenAccum.current >= 1) {
        const prevMatched = tracks.find(t => t.id === prevTrackId.current);
        dispatch(
          recordListenTime({
            trackId: prevTrackId.current,
            artist: prevMatched?.artist || '',
            seconds: Math.round(listenAccum.current),
          }),
        );
      }
      listenAccum.current = 0;
      lastTickTime.current = 0;
      prevTrackId.current = activeTrackId;
    }
  }, [activePlayer, activeTrack?.id, currentTrack?.id, tracks, dispatch]);

  useEffect(() => {
    const activeTrackId = activePlayer === 'vlc' ? currentTrack?.id : activeTrack?.id;
    if (!activeTrackId) return;
    const matched = tracks.find(t => t.id === activeTrackId);
    if (!matched) return;
    // Skip if Redux already has the correct track (avoid overriding playTrack.pending)
    if (currentTrackIdRef.current !== matched.id) {
      dispatch(setCurrentTrack(matched));
      dispatch(setCurrentIndex(tracks.findIndex(t => t.id === activeTrackId)));
    }
    setOriginalTrackInfo(matched.title, matched.artist, matched.artwork);

    const loadLyrics = async () => {
      let lines: import('../types').LyricLine[] = [];
      if (matched.lrcPath) {
        lines = parseLRC(await readLrcFile(matched.lrcPath));
      } else if (matched.embeddedLyrics) {
        lines = parseLRC(matched.embeddedLyrics);
        if (lines.length === 0) {
          lines = parseTextLyrics(matched.embeddedLyrics, matched.duration);
        }
      }
      // iOS: AVURLAsset 元数据读取内嵌歌词
      if (lines.length === 0 && Platform.OS === 'ios' && matched.url) {
        const native = await getLyricsForUrl(matched.url);
        if (native) {
          lines = parseLRC(native);
          if (lines.length === 0) {
            lines = parseTextLyrics(native, matched.duration);
          }
        }
      }
      // Fallback: search the default lrc directory for a matching .lrc file
      if (lines.length === 0) {
        const lrcDir = getDefaultLrcDir();
        const matchedLrc = await findMatchingLrcInDir(matched, lrcDir);
        if (matchedLrc) {
          lines = parseLRC(await readLrcFile(matchedLrc));
        }
      }
      dispatch(setLyrics(lines));
    };
    loadLyrics();
  }, [activePlayer, activeTrack?.id, currentTrack?.id, dispatch, tracks]);

  // 检测单曲循环重播
  useEffect(() => {
    if (prevPosition.current > 3 && position < 1) {
      lastLyricIdx.current = -1;
      dispatch(setCurrentLyricIndex(-1));
    }
    prevPosition.current = position;
  }, [position, dispatch]);

  // 累计听歌时长，每 30 秒记录一次
  useEffect(() => {
    const playing =
      activePlayer === 'vlc' ? vlcSnapshot.isPlaying : playbackState.state === State.Playing;
    const activeTrackId = activePlayer === 'vlc' ? currentTrack?.id : activeTrack?.id;
    if (!playing || !activeTrackId) {
      lastTickTime.current = 0;
      return;
    }
    const now = Date.now();
    if (lastTickTime.current > 0) {
      const delta = (now - lastTickTime.current) / 1000;
      if (delta > 0 && delta < 5) {
        listenAccum.current += delta;
      }
    }
    lastTickTime.current = now;

    if (listenAccum.current >= 30) {
      const matched = tracks.find(t => t.id === activeTrackId);
      dispatch(
        recordListenTime({
          trackId: activeTrackId,
          artist: matched?.artist || '',
          seconds: Math.round(listenAccum.current),
        }),
      );
      listenAccum.current = 0;
    }
  }, [
    position,
    playbackState.state,
    activePlayer,
    activeTrack,
    currentTrack,
    tracks,
    dispatch,
    vlcSnapshot.isPlaying,
  ]);

  // 歌词同步（lyricsOffset: 正值 = 歌词提前，负值 = 歌词延后）
  const lyricsOffset = useAppSelector(s => s.music.lyricsOffset);
  useEffect(() => {
    if (lyrics.length === 0) return;
    const idx = findCurrentLyricIndex(lyrics, position + lyricsOffset);
    if (idx !== lastLyricIdx.current) {
      lastLyricIdx.current = idx;
      dispatch(setCurrentLyricIndex(idx));
      // Push current lyric to car display via Bluetooth AVRCP
      if (isBluetoothLyricsEnabled() && idx >= 0) {
        pushLyricToNowPlaying(lyrics[idx].text);
      } else if (isBluetoothLyricsEnabled() && idx < 0) {
        restoreOriginalMetadata();
      }
    }
  }, [position, lyrics, lyricsOffset, dispatch]);

  // 定期保存播放进度（每 3 秒）
  const lastSaveRef = useRef(0);
  useEffect(() => {
    const activeTrackId = activePlayer === 'vlc' ? currentTrack?.id : activeTrack?.id;
    if (position < 1 || !activeTrackId) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 3000) return;
    lastSaveRef.current = now;
    AsyncStorage.setItem(
      '@lastPlayback',
      JSON.stringify({
        trackId: activeTrackId,
        position,
      }),
    ).catch(() => {});
  }, [position, activePlayer, activeTrack?.id, currentTrack?.id]);

  // Push to Dynamic Island every ~1 second
  const lastLAUpdate = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const now = Date.now();
    if (now - lastLAUpdate.current < 1000) return;
    lastLAUpdate.current = now;

    const playing =
      activePlayer === 'vlc' ? vlcSnapshot.isPlaying : playbackState.state === State.Playing;
    const liveTrackId = activePlayer === 'vlc' ? currentTrack?.id : activeTrack?.id;
    const matched = tracks.find(t => t.id === liveTrackId);
    if (!matched) {
      if (isLiveActivityActive()) stopLiveActivity().catch(() => {});
      return;
    }
    const progress = duration > 0 ? position / duration : 0;
    updateLiveActivity(
      playing,
      matched.title,
      matched.artist || '',
      progress,
      matched.artwork,
    ).catch(() => {});
  }, [
    position,
    playbackState.state,
    activePlayer,
    activeTrack?.id,
    currentTrack?.id,
    duration,
    tracks,
    vlcSnapshot.isPlaying,
  ]);

  // Fix iOS lock screen progress: when app returns to foreground, update
  // MPNowPlayingInfoCenter elapsed time without interrupting playback.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (activePlayer === 'vlc') return;
    const sub = AppState.addEventListener('change', async nextState => {
      if (nextState === 'active') {
        try {
          const { position: pos } = await TrackPlayer.getProgress();
          if (pos > 0) {
            await TrackPlayer.updateNowPlayingMetadata({ elapsedTime: pos });
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, [activePlayer]);

  // Periodically sync elapsed time to MPNowPlayingInfoCenter while playing.
  // This prevents stale elapsedPlaybackTime from any metadata update calls.
  const lastNPSync = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (activePlayer === 'vlc') return;
    const playing = playbackState.state === State.Playing;
    if (!playing || position < 1) return;
    const now = Date.now();
    if (now - lastNPSync.current < 10000) return;
    lastNPSync.current = now;
    TrackPlayer.updateNowPlayingMetadata({ elapsedTime: position }).catch(() => {});
  }, [position, playbackState.state, activePlayer]);

  return { position, duration };
}

export function usePlayerControls() {
  const dispatch = useAppDispatch();
  const {
    lyrics,
    currentLyricIndex,
    tracks,
    currentTrack,
    repeatMode,
    playQueue,
    shuffleHistory,
    shuffleHistoryIndex,
    activePlayer,
  } = useAppSelector(s => s.music);
  const vlcSnapshot = useVlcSnapshot();

  const togglePlayPause = useCallback(async () => {
    // If VLC track was restored from cache but not yet playing, start it via playTrack
    if (currentTrack && shouldUseVlcForTrack(currentTrack) && !vlcSnapshot.isPlaying && vlcSnapshot.position === 0 && vlcSnapshot.duration === 0) {
      const queue = playQueue.length > 0 ? playQueue : tracks;
      dispatch(playTrack({ track: currentTrack, queue }));
      return;
    }
    if (activePlayer === 'vlc') {
      if (vlcSnapshot.isPlaying) {
        await pauseVlc();
      } else {
        await resumeVlc();
      }
      return;
    }
    const s = await TrackPlayer.getPlaybackState();
    s.state === State.Playing ? await TrackPlayer.pause() : await TrackPlayer.play();
  }, [activePlayer, vlcSnapshot.isPlaying, vlcSnapshot.position, vlcSnapshot.duration, currentTrack, tracks, playQueue, dispatch]);

  const seekTo = useCallback(async (sec: number) => {
    if (activePlayer === 'vlc') {
      await seekVlc(sec);
      return;
    }
    await TrackPlayer.seekTo(sec);
  }, [activePlayer]);

  /**
   * 下一曲：随机模式下使用 shuffle history 导航
   */
  const skipToNext = useCallback(async () => {
    const queue = playQueue.length > 0 ? playQueue : tracks;

    if (repeatMode === 'queue' && queue.length > 1) {
      // 随机模式：先检查是否在历史中部（用户按过上一曲），可以前进
      if (shuffleHistoryIndex < shuffleHistory.length - 1) {
        const nextId = shuffleHistory[shuffleHistoryIndex + 1];
        const nextTrack = queue.find(t => t.id === nextId);
        if (nextTrack) {
          dispatch(shuffleHistoryForward());
          dispatch(playTrack({ track: nextTrack, queue, navigatingShuffleHistory: true }));
          return;
        }
      }
      // 在历史末尾：随机选一首新歌
      const candidates = queue.filter(t => t.id !== currentTrack?.id);
      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        dispatch(playTrack({ track: random, queue }));
        return;
      }
    }

    // 非随机 + TrackPlayer：检查 TP 队列是否有下一首
    if (activePlayer !== 'vlc') {
      try {
        const activeIdx = await TrackPlayer.getActiveTrackIndex();
        const tpQueue = await TrackPlayer.getQueue();
        if (activeIdx != null && activeIdx < tpQueue.length - 1) {
          await TrackPlayer.skipToNext();
          return;
        }
      } catch {}
    }

    // TP 队列耗尽 - 从完整播放队列中找下一首
    if (queue.length > 0 && currentTrack) {
      const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
      if (currentIdx >= 0) {
        const nextIdx = (currentIdx + 1) % queue.length;
        dispatch(playTrack({ track: queue[nextIdx], queue }));
      }
    }
  }, [
    repeatMode,
    tracks,
    currentTrack,
    playQueue,
    shuffleHistory,
    shuffleHistoryIndex,
    dispatch,
    activePlayer,
  ]);

  /**
   * 上一曲：随机模式下通过 shuffle history 向后导航
   */
  const skipToPrevious = useCallback(async () => {
    const queue = playQueue.length > 0 ? playQueue : tracks;

    if (repeatMode === 'queue' && queue.length > 1) {
      // 随机模式：在 shuffle history 中后退
      if (shuffleHistoryIndex > 0) {
        const prevId = shuffleHistory[shuffleHistoryIndex - 1];
        const prevTrack = queue.find(t => t.id === prevId);
        if (prevTrack) {
          dispatch(shuffleHistoryBack());
          dispatch(playTrack({ track: prevTrack, queue, navigatingShuffleHistory: true }));
          return;
        }
      }
      // 已在历史起点：随机选一首插入历史开头并播放
      const candidates = queue.filter(t => t.id !== currentTrack?.id);
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        dispatch(prependShuffleHistory(pick.id));
        dispatch(playTrack({ track: pick, queue, navigatingShuffleHistory: true }));
      }
      return;
    }

    // 非随机 + TrackPlayer：检查 TP 队列是否有上一首
    if (activePlayer !== 'vlc') {
      try {
        const activeIdx = await TrackPlayer.getActiveTrackIndex();
        if (activeIdx != null && activeIdx > 0) {
          await TrackPlayer.skipToPrevious();
          return;
        }
      } catch {}
    }

    // TP 队列耗尽 - 从完整播放队列中找上一首
    if (queue.length > 0 && currentTrack) {
      const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
      if (currentIdx >= 0) {
        const prevIdx = (currentIdx - 1 + queue.length) % queue.length;
        dispatch(playTrack({ track: queue[prevIdx], queue }));
      }
    }
  }, [
    repeatMode,
    tracks,
    playQueue,
    shuffleHistory,
    shuffleHistoryIndex,
    currentTrack,
    dispatch,
    activePlayer,
  ]);

  /** 播放指定歌词行，到该行结束自动暂停 */
  const seekAndStop = useCallback(
    async (lyricIdx: number) => {
      const startTime = lyrics[lyricIdx].time;
      const endTime = lyricIdx + 1 < lyrics.length ? lyrics[lyricIdx + 1].time : undefined;

      if (activePlayer === 'vlc') {
        await seekVlc(startTime);
        await resumeVlc();
      } else {
        await TrackPlayer.seekTo(startTime);
        await TrackPlayer.play();
      }

      if (endTime !== undefined) {
        const iv = setInterval(async () => {
          try {
            const position =
              activePlayer === 'vlc'
                ? getVlcSnapshot().position
                : (await TrackPlayer.getProgress()).position;
            if (position >= endTime - 0.1) {
              clearInterval(iv);
              if (activePlayer === 'vlc') {
                await pauseVlc();
              } else {
                await TrackPlayer.pause();
              }
            }
          } catch {
            clearInterval(iv);
          }
        }, 100);
        setTimeout(() => clearInterval(iv), 30000);
      }
    },
    [lyrics, activePlayer],
  );

  const seekToPrevLyric = useCallback(async () => {
    if (lyrics.length === 0 || currentLyricIndex <= 0) return;
    await seekAndStop(currentLyricIndex - 1);
  }, [lyrics, currentLyricIndex, seekAndStop]);

  const seekToNextLyric = useCallback(async () => {
    if (lyrics.length === 0 || currentLyricIndex >= lyrics.length - 1) return;
    await seekAndStop(currentLyricIndex + 1);
  }, [lyrics, currentLyricIndex, seekAndStop]);

  const replayCurrentLyric = useCallback(async () => {
    if (lyrics.length === 0 || currentLyricIndex < 0) return;
    await seekAndStop(currentLyricIndex);
  }, [lyrics, currentLyricIndex, seekAndStop]);

  return {
    togglePlayPause,
    skipToNext,
    skipToPrevious,
    seekTo,
    seekToPrevLyric,
    seekToNextLyric,
    replayCurrentLyric,
  };
}
