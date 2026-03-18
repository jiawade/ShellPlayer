// src/screens/FullPlayerScreen.tsx
import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { RepeatMode as TPRepeatMode } from 'react-native-track-player';
import { useNavigation } from '@react-navigation/native';
import CoverArt from '../components/CoverArt';
import ProgressBar from '../components/ProgressBar';
import LyricsView from '../components/LyricsView';
import Equalizer from '../components/Equalizer';
import SleepTimer from '../components/SleepTimer';
import PlayQueueView from '../components/PlayQueueView';
import { useAppSelector, useAppDispatch } from '../store';
import { setShowFullPlayer, toggleShowLyrics, toggleFavorite, setRepeatMode, setPlaybackSpeed } from '../store/musicSlice';
import { usePlayerControls, usePlayerSync } from '../hooks/usePlayerProgress';
import { useTheme } from '../contexts/ThemeContext';
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
  const navigation = useNavigation<any>();
  const { currentTrack, isPlaying, showLyrics, repeatMode, lyrics, playbackSpeed, sleepTimerEnd } = useAppSelector(s => s.music);
  const { togglePlayPause, skipToNext, skipToPrevious } = usePlayerControls();
  const { position, duration } = usePlayerSync();
  const { colors, sizes, isDark } = useTheme();
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

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      dispatch(setShowFullPlayer(false));
    });
    return unsub;
  }, [navigation, dispatch]);

  if (!currentTrack) return null;

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
  const hasTimer = sleepTimerEnd && sleepTimerEnd > Date.now();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hBtn} hitSlop={12}>
          <Icon name="chevron-down" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.hCenter}>
          <Text style={{ fontSize: sizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 2 }}>正在播放</Text>
          <Text style={{ fontSize: sizes.sm, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{headerTitle}</Text>
        </View>
        <TouchableOpacity onPress={() => dispatch(toggleFavorite(currentTrack.id))} style={styles.hBtn} hitSlop={12}>
          <Icon name={currentTrack.isFavorite ? 'heart' : 'heart-outline'} size={24} color={currentTrack.isFavorite ? colors.heart : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View style={styles.main}>
        {showLyrics ? (
          <View style={styles.lyricsContainer}>
            <TouchableOpacity onPress={() => dispatch(toggleShowLyrics())} style={[styles.backToCoverBtn, { backgroundColor: colors.accentDim }]} activeOpacity={0.7}>
              <Icon name="image-outline" size={16} color={colors.accent} /><Text style={{ fontSize: sizes.xs, color: colors.accent, fontWeight: '600' }}>封面</Text>
            </TouchableOpacity>
            <LyricsView />
          </View>
        ) : (
          <TouchableOpacity style={styles.coverArea} activeOpacity={0.95} onPress={() => dispatch(toggleShowLyrics())}>
            <View style={[styles.coverGlow, { shadowColor: colors.accent }]}><CoverArt artwork={currentTrack.artwork} size={COVER} borderRadius={28} /></View>
            <View style={styles.trackInfo}>
              <Text style={{ fontSize: sizes.xxl, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', lineHeight: 36 }} numberOfLines={2}>{currentTrack.title}</Text>
              <Text style={{ fontSize: sizes.lg, color: colors.textSecondary, marginTop: 6 }} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
            <View style={[styles.lyrHint, { backgroundColor: colors.accentDim }]}><Icon name="document-text-outline" size={16} color={colors.accent} /><Text style={{ fontSize: sizes.xs, color: colors.accent }}>点击查看歌词</Text></View>
          </TouchableOpacity>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ProgressBar position={position} duration={duration} />

        <View style={styles.funcRow}>
          <TouchableOpacity onPress={() => setShowSleep(true)} style={styles.funcBtn}>
            <Icon name={hasTimer ? 'moon' : 'moon-outline'} size={18} color={hasTimer ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSpeed(!showSpeed)} style={styles.funcBtn}>
            <Text style={[styles.speedLabel, { color: colors.textMuted }, playbackSpeed !== 1.0 && { color: colors.accent }]}>{playbackSpeed}x</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowQueue(true)} style={styles.funcBtn}>
            <Icon name="list-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {showSpeed && (
          <View style={styles.speedRow}>
            {SPEEDS.map(s => (
              <TouchableOpacity key={s} style={[styles.speedBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }, playbackSpeed === s && { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => changeSpeed(s)}>
                <Text style={[styles.speedBtnTxt, { color: colors.textMuted }, playbackSpeed === s && { color: colors.bg }]}>{s}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.mainCtrl}>
          <TouchableOpacity onPress={cycleRepeat} style={styles.ctrlSideBtn}>
            <Icon name={cfg.icon} size={22} color={repeatMode !== 'off' ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToPrevious} style={styles.ctrlBtn}>
            <Icon name="play-skip-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} style={[styles.playBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]} activeOpacity={0.8}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={colors.bg} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToNext} style={styles.ctrlBtn}>
            <Icon name="play-skip-forward" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowEQ(true)} style={styles.ctrlSideBtn}>
            <Icon name="options-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {showModeToast !== '' && (
        <View style={[styles.modeToast, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Icon name={cfg.icon} size={16} color={colors.accent} />
          <Text style={{ fontSize: sizes.sm, color: colors.accent, fontWeight: '600' }}>{showModeToast}</Text>
        </View>
      )}

      <Equalizer visible={showEQ} onClose={() => setShowEQ(false)} />
      <SleepTimer visible={showSleep} onClose={() => setShowSleep(false)} />
      <PlayQueueView visible={showQueue} onClose={() => setShowQueue(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10 },
  hBtn: { padding: 8, width: 44, alignItems: 'center' },
  hCenter: { flex: 1, alignItems: 'center' },
  main: { flex: 1 },
  lyricsContainer: { flex: 1 },
  backToCoverBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, marginBottom: 4, borderRadius: 16, gap: 6 },
  coverArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  coverGlow: { shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 },
  trackInfo: { alignItems: 'center', marginTop: 28, paddingHorizontal: 40 },
  lyrHint: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, gap: 6 },
  controls: { paddingBottom: 34 },
  funcRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8, marginBottom: 4 },
  funcBtn: { padding: 8 },
  speedLabel: { fontSize: 12, fontWeight: '700' },
  speedRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  speedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  speedBtnTxt: { fontSize: 12, fontWeight: '600' },
  mainCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctrlSideBtn: { width: 48, alignItems: 'center', justifyContent: 'center' },
  ctrlBtn: { width: 56, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 12,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  modeToast: { position: 'absolute', bottom: 90, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, elevation: 6 },
});

export default memo(FullPlayerScreen);
