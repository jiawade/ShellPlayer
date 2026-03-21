// src/hooks/usePlayerProgress.ts
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import TrackPlayer, {
  useProgress,
  usePlaybackState,
  useActiveTrack,
  State,
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setIsPlaying, setCurrentTrack, setCurrentLyricIndex,
  setLyrics, setCurrentIndex, playTrack,
} from '../store/musicSlice';
import { findCurrentLyricIndex, parseLRC, parseTextLyrics } from '../utils/lrcParser';
import { readLrcFile, findMatchingLrcInDir } from '../utils/scanner';
import { getLyricsForUrl } from '../utils/mediaLibrary';
import { getDefaultLrcDir } from '../utils/defaultDirs';

export function usePlayerSync() {
  const dispatch = useAppDispatch();
  const { position, duration } = useProgress(200);
  const playbackState = usePlaybackState();
  const activeTrack = useActiveTrack();
  const { lyrics, tracks } = useAppSelector(s => s.music);
  const lastLyricIdx = useRef(-1);
  const prevPosition = useRef(0);

  useEffect(() => {
    const playing = playbackState.state === State.Playing
                 || playbackState.state === State.Buffering;
    dispatch(setIsPlaying(playing));
  }, [playbackState.state, dispatch]);

  useEffect(() => {
    if (!activeTrack) return;
    const matched = tracks.find(t => t.id === activeTrack.id);
    if (!matched) return;
    dispatch(setCurrentTrack(matched));
    dispatch(setCurrentIndex(tracks.findIndex(t => t.id === activeTrack.id)));

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
  }, [activeTrack?.id, dispatch, tracks]);

  // 检测单曲循环重播
  useEffect(() => {
    if (prevPosition.current > 3 && position < 1) {
      lastLyricIdx.current = -1;
      dispatch(setCurrentLyricIndex(-1));
    }
    prevPosition.current = position;
  }, [position, dispatch]);

  // 歌词同步
  useEffect(() => {
    if (lyrics.length === 0) return;
    const idx = findCurrentLyricIndex(lyrics, position);
    if (idx !== lastLyricIdx.current) {
      lastLyricIdx.current = idx;
      dispatch(setCurrentLyricIndex(idx));
    }
  }, [position, lyrics, dispatch]);

  // 定期保存播放进度（每 3 秒）
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (position < 1 || !activeTrack) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 3000) return;
    lastSaveRef.current = now;
    AsyncStorage.setItem('@lastPlayback', JSON.stringify({
      trackId: activeTrack.id, position,
    })).catch(() => {});
  }, [position, activeTrack]);

  return { position, duration };
}

export function usePlayerControls() {
  const dispatch = useAppDispatch();
  const { lyrics, currentLyricIndex, tracks, currentTrack, repeatMode, playHistory, playQueue } = useAppSelector(s => s.music);

  const togglePlayPause = useCallback(async () => {
    const s = await TrackPlayer.getPlaybackState();
    s.state === State.Playing ? await TrackPlayer.pause() : await TrackPlayer.play();
  }, []);

  const seekTo = useCallback(async (sec: number) => {
    await TrackPlayer.seekTo(sec);
  }, []);

  /**
   * 下一曲：随机模式下从全部歌曲中随机选一首
   */
  const skipToNext = useCallback(async () => {
    const queue = playQueue.length > 0 ? playQueue : tracks;

    if (repeatMode === 'queue' && queue.length > 1) {
      // 随机模式：从列表中随机选一首（排除当前歌曲）
      const candidates = queue.filter(t => t.id !== currentTrack?.id);
      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        dispatch(playTrack({ track: random, queue }));
        return;
      }
    }

    // 非随机：检查 TP 队列是否有下一首
    try {
      const activeIdx = await TrackPlayer.getActiveTrackIndex();
      const tpQueue = await TrackPlayer.getQueue();
      if (activeIdx != null && activeIdx < tpQueue.length - 1) {
        await TrackPlayer.skipToNext();
        return;
      }
    } catch {}

    // TP 队列耗尽 - 从完整播放队列中找下一首
    if (queue.length > 0 && currentTrack) {
      const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
      if (currentIdx >= 0) {
        const nextIdx = (currentIdx + 1) % queue.length;
        dispatch(playTrack({ track: queue[nextIdx], queue }));
      }
    }
  }, [repeatMode, tracks, currentTrack, playQueue, dispatch]);

  /**
   * 上一曲：随机模式下播放上一次播放的歌曲（从播放历史中获取）
   */
  const skipToPrevious = useCallback(async () => {
    const queue = playQueue.length > 0 ? playQueue : tracks;

    if (repeatMode === 'queue' && queue.length > 1) {
      // playHistory[0] is the current track, [1] is the one before
      if (playHistory.length >= 2) {
        const prevEntry = playHistory[1];
        const prevTrack = queue.find(t => t.id === prevEntry.trackId);
        if (prevTrack) {
          dispatch(playTrack({ track: prevTrack, queue }));
          return;
        }
      }
    }

    // 非随机：检查 TP 队列是否有上一首
    try {
      const activeIdx = await TrackPlayer.getActiveTrackIndex();
      if (activeIdx != null && activeIdx > 0) {
        await TrackPlayer.skipToPrevious();
        return;
      }
    } catch {}

    // TP 队列耗尽 - 从完整播放队列中找上一首
    if (queue.length > 0 && currentTrack) {
      const currentIdx = queue.findIndex(t => t.id === currentTrack.id);
      if (currentIdx >= 0) {
        const prevIdx = (currentIdx - 1 + queue.length) % queue.length;
        dispatch(playTrack({ track: queue[prevIdx], queue }));
      }
    }
  }, [repeatMode, tracks, playHistory, playQueue, currentTrack, dispatch]);

  /** 播放指定歌词行，到该行结束自动暂停 */
  const seekAndStop = useCallback(async (lyricIdx: number) => {
    const startTime = lyrics[lyricIdx].time;
    const endTime = lyricIdx + 1 < lyrics.length ? lyrics[lyricIdx + 1].time : undefined;

    await TrackPlayer.seekTo(startTime);
    await TrackPlayer.play();

    if (endTime !== undefined) {
      const iv = setInterval(async () => {
        try {
          const { position } = await TrackPlayer.getProgress();
          if (position >= endTime - 0.1) { clearInterval(iv); await TrackPlayer.pause(); }
        } catch { clearInterval(iv); }
      }, 100);
      setTimeout(() => clearInterval(iv), 30000);
    }
  }, [lyrics]);

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
    togglePlayPause, skipToNext, skipToPrevious, seekTo,
    seekToPrevLyric, seekToNextLyric, replayCurrentLyric,
  };
}
