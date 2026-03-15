// src/screens/FullPlayerScreen.tsx
import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { RepeatMode as TPRepeatMode } from 'react-native-track-player';
import CoverArt from '../components/CoverArt';
import ProgressBar from '../components/ProgressBar';
import LyricsView from '../components/LyricsView';
import Equalizer from '../components/Equalizer';
import SleepTimer from '../components/SleepTimer';
import PlayQueueView from '../components/PlayQueueView';
import { useAppSelector, useAppDispatch } from '../store';
import { setShowFullPlayer, toggleShowLyrics, toggleFavorite, setRepeatMode, setPlaybackSpeed } from '../store/musicSlice';
import { usePlayerControls, usePlayerSync } from '../hooks/usePlayerProgress';
import { COLORS, SIZES } from '../utils/theme';
import { RepeatMode } from '../types';

const COVER = Dimensions.get('window').width * 0.7;
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const PLAY_MODES: { mode: RepeatMode; icon: string; label: string }[] = [
  { mode: 'off', icon: 'arrow-forward-outline', label: '顺序播放' },
  { mode: 'queue', icon: 'shuffle-outline', label: '随机播放' },
  { mode: 'track', icon: 'sync-outline', label: '单曲循环' },
];

const FullPlayerScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentTrack, isPlaying, showLyrics, repeatMode, lyrics, playbackSpeed, sleepTimerEnd } = useAppSelector(s => s.music);
  const { togglePlayPause, skipToNext, skipToPrevious } = usePlayerControls();
  const { position, duration } = usePlayerSync();
  const [showEQ, setShowEQ] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showModeToast, setShowModeToast] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@playMode');
        if (saved) { const p = JSON.parse(saved); dispatch(setRepeatMode(p.repeat || 'off')); }
      } catch {}
    })();
  }, [dispatch]);

  if (!currentTrack) return null;

  // 标题显示逻辑：歌手 - 歌曲名，缺失则显示文件名
  const headerTitle = (() => {
    const hasArtist = currentTrack.artist && currentTrack.artist !== '未知歌手';
    const hasTitle = currentTrack.title && currentTrack.title !== currentTrack.fileName;
    if (hasArtist && hasTitle) return `${currentTrack.artist} - ${currentTrack.title}`;
    if (hasTitle) return currentTrack.title;
    if (hasArtist) return currentTrack.artist;
    return currentTrack.fileName;
  })();

  const cycleRepeat = async () => {
    const idx = PLAY_MODES.findIndex(m => m.mode === repeatMode);
    const next = PLAY_MODES[(idx + 1) % PLAY_MODES.length];
    dispatch(setRepeatMode(next.mode));
    if (next.mode === 'track') await TrackPlayer.setRepeatMode(TPRepeatMode.Track);
    else if (next.mode === 'queue') await TrackPlayer.setRepeatMode(TPRepeatMode.Queue);
    else await TrackPlayer.setRepeatMode(TPRepeatMode.Off);
    try { await AsyncStorage.setItem('@playMode', JSON.stringify({ repeat: next.mode })); } catch {}
    setShowModeToast(next.label); setTimeout(() => setShowModeToast(''), 1500);
  };

  const changeSpeed = (spd: number) => { dispatch(setPlaybackSpeed(spd)); setShowSpeed(false); };

  const cfg = PLAY_MODES.find(m => m.mode === repeatMode) || PLAY_MODES[0];
  const hasLyrics = lyrics.length > 0;
  const hasTimer = sleepTimerEnd && sleepTimerEnd > Date.now();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header: 歌手 - 歌曲名 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => dispatch(setShowFullPlayer(false))} style={styles.hBtn} hitSlop={12}>
          <Icon name="chevron-down" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.hCenter}>
          <Text style={styles.hLabel}>正在播放</Text>
          <Text style={styles.hTitle} numberOfLines={1}>{headerTitle}</Text>
        </View>
        <TouchableOpacity onPress={() => dispatch(toggleFavorite(currentTrack.id))} style={styles.hBtn} hitSlop={12}>
          <Icon name={currentTrack.isFavorite ? 'heart' : 'heart-outline'} size={24} color={currentTrack.isFavorite ? COLORS.heart : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View style={styles.main}>
        {showLyrics ? (
          <View style={styles.lyricsContainer}>
            <TouchableOpacity onPress={() => dispatch(toggleShowLyrics())} style={styles.backToCoverBtn} activeOpacity={0.7}>
              <Icon name="image-outline" size={16} color={COLORS.accent} /><Text style={styles.backToCoverTxt}>封面</Text>
            </TouchableOpacity>
            <LyricsView />
          </View>
        ) : (
          <TouchableOpacity style={styles.coverArea} activeOpacity={0.95} onPress={() => hasLyrics && dispatch(toggleShowLyrics())}>
            <View style={styles.coverGlow}><CoverArt artwork={currentTrack.artwork} size={COVER} borderRadius={SIZES.radiusXl} /></View>
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle} numberOfLines={2}>{currentTrack.title}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
            {hasLyrics && <View style={styles.lyrHint}><Icon name="document-text-outline" size={16} color={COLORS.accent} /><Text style={styles.lyrHintTxt}>点击查看歌词</Text></View>}
          </TouchableOpacity>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ProgressBar position={position} duration={duration} />

        {/* 功能按钮行 */}
        <View style={styles.funcRow}>
          <TouchableOpacity onPress={() => setShowSleep(true)} style={styles.funcBtn}>
            <Icon name={hasTimer ? 'moon' : 'moon-outline'} size={18} color={hasTimer ? COLORS.accent : COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSpeed(!showSpeed)} style={styles.funcBtn}>
            <Text style={[styles.speedLabel, playbackSpeed !== 1.0 && { color: COLORS.accent }]}>{playbackSpeed}x</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowQueue(true)} style={styles.funcBtn}>
            <Icon name="list-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowEQ(true)} style={styles.funcBtn}>
            <Icon name="options-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 倍速选择 */}
        {showSpeed && (
          <View style={styles.speedRow}>
            {SPEEDS.map(s => (
              <TouchableOpacity key={s} style={[styles.speedBtn, playbackSpeed === s && styles.speedBtnActive]} onPress={() => changeSpeed(s)}>
                <Text style={[styles.speedBtnTxt, playbackSpeed === s && { color: COLORS.bg }]}>{s}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 主控制栏 - 完全居中 */}
        <View style={styles.mainCtrl}>
          <TouchableOpacity onPress={cycleRepeat} style={styles.ctrlSideBtn}>
            <Icon name={cfg.icon} size={22} color={repeatMode !== 'off' ? COLORS.accent : COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToPrevious} style={styles.ctrlBtn}>
            <Icon name="play-skip-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn} activeOpacity={0.8}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={COLORS.bg} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToNext} style={styles.ctrlBtn}>
            <Icon name="play-skip-forward" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.ctrlSideBtn} />
        </View>
      </View>

      {showModeToast !== '' && <View style={styles.modeToast}><Icon name={cfg.icon} size={16} color={COLORS.accent} /><Text style={styles.modeToastText}>{showModeToast}</Text></View>}

      <Equalizer visible={showEQ} onClose={() => setShowEQ(false)} />
      <SleepTimer visible={showSleep} onClose={() => setShowSleep(false)} />
      <PlayQueueView visible={showQueue} onClose={() => setShowQueue(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10 },
  hBtn: { padding: 8, width: 44, alignItems: 'center' },
  hCenter: { flex: 1, alignItems: 'center' },
  hLabel: { fontSize: SIZES.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
  hTitle: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  // Main
  main: { flex: 1 },
  lyricsContainer: { flex: 1 },
  backToCoverBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, marginBottom: 4, borderRadius: 16, backgroundColor: COLORS.accentDim, gap: 6 },
  backToCoverTxt: { fontSize: SIZES.xs, color: COLORS.accent, fontWeight: '600' },
  coverArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  coverGlow: { shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 },
  trackInfo: { alignItems: 'center', marginTop: 28, paddingHorizontal: 40 },
  trackTitle: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', lineHeight: 36 },
  trackArtist: { fontSize: SIZES.lg, color: COLORS.textSecondary, marginTop: 6 },
  lyrHint: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.accentDim, gap: 6 },
  lyrHintTxt: { fontSize: SIZES.xs, color: COLORS.accent },
  // Controls
  controls: { paddingBottom: 34 },
  funcRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8, marginBottom: 4 },
  funcBtn: { padding: 8 },
  speedLabel: { fontSize: SIZES.sm, color: COLORS.textMuted, fontWeight: '700' },
  speedRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  speedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  speedBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  speedBtnTxt: { fontSize: SIZES.sm, color: COLORS.textMuted, fontWeight: '600' },
  // 主控制栏 - 用固定宽度确保居中
  mainCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctrlSideBtn: { width: 48, alignItems: 'center', justifyContent: 'center' },
  ctrlBtn: { width: 56, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 12,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  // Toast
  modeToast: { position: 'absolute', bottom: 90, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, elevation: 6 },
  modeToastText: { fontSize: SIZES.sm, color: COLORS.accent, fontWeight: '600' },
});

export default memo(FullPlayerScreen);
