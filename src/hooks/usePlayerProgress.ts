// src/hooks/usePlayerProgress.ts
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import TrackPlayer, {
  useProgress,
  usePlaybackState,
  useActiveTrack,
  State,
} from 'react-native-track-player';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setIsPlaying, setCurrentTrack, setCurrentLyricIndex,
  setLyrics, setCurrentIndex, playTrack,
} from '../store/musicSlice';
import { findCurrentLyricIndex, parseLRC, parseTextLyrics } from '../utils/lrcParser';
import { readLrcFile } from '../utils/scanner';
import { getLyricsForUrl } from '../utils/mediaLibrary';

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

  return { position, duration };
}

export function usePlayerControls() {
  const dispatch = useAppDispatch();
  const { lyrics, currentLyricIndex, tracks, currentTrack, repeatMode } = useAppSelector(s => s.music);

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
    if (repeatMode === 'queue' && tracks.length > 1) {
      // 随机模式：从列表中随机选一首（排除当前歌曲）
      const candidates = tracks.filter(t => t.id !== currentTrack?.id);
      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        dispatch(playTrack({ track: random, queue: tracks, shuffle: false }));
        return;
      }
    }
    try { await TrackPlayer.skipToNext(); } catch {}
  }, [repeatMode, tracks, currentTrack, dispatch]);

  /**
   * 上一曲：随机模式下也随机选一首
   */
  const skipToPrevious = useCallback(async () => {
    if (repeatMode === 'queue' && tracks.length > 1) {
      const candidates = tracks.filter(t => t.id !== currentTrack?.id);
      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        dispatch(playTrack({ track: random, queue: tracks, shuffle: false }));
        return;
      }
    }
    try { await TrackPlayer.skipToPrevious(); } catch {}
  }, [repeatMode, tracks, currentTrack, dispatch]);

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
