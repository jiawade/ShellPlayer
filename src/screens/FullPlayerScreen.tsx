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
import { useAppSelector, useAppDispatch } from '../store';
import { setShowFullPlayer, toggleShowLyrics, toggleFavorite, setRepeatMode } from '../store/musicSlice';
import { usePlayerControls, usePlayerSync } from '../hooks/usePlayerProgress';
import { COLORS, SIZES } from '../utils/theme';
import { RepeatMode } from '../types';

const COVER = Dimensions.get('window').width * 0.7;

const PLAY_MODES: { mode: RepeatMode; icon: string; label: string }[] = [
  { mode: 'off', icon: 'arrow-forward-outline', label: '顺序播放' },
  { mode: 'queue', icon: 'shuffle-outline', label: '随机播放' },
  { mode: 'track', icon: 'sync-outline', label: '单曲循环' },
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FullPlayerScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentTrack, isPlaying, showLyrics, repeatMode, lyrics, tracks } = useAppSelector(s => s.music);
  const { togglePlayPause, skipToNext, skipToPrevious } = usePlayerControls();
  const { position, duration } = usePlayerSync();
  const [showEQ, setShowEQ] = useState(false);
  const [showModeToast, setShowModeToast] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@playMode');
        if (saved) {
          const parsed = JSON.parse(saved);
          const mode = parsed.repeat || 'off';
          dispatch(setRepeatMode(mode));
          await applyMode(mode, null, []);
        }
      } catch {}
    })();
  }, [dispatch]);

  if (!currentTrack) return null;

  const cycleRepeat = async () => {
    const currentIdx = PLAY_MODES.findIndex(m => m.mode === repeatMode);
    const nextIdx = (currentIdx + 1) % PLAY_MODES.length;
    const next = PLAY_MODES[nextIdx];
    dispatch(setRepeatMode(next.mode));

    // 应用到 TrackPlayer
    await applyMode(next.mode, currentTrack, tracks);

    try {
      await AsyncStorage.setItem('@playMode', JSON.stringify({ repeat: next.mode }));
    } catch {}

    setShowModeToast(next.label);
    setTimeout(() => setShowModeToast(''), 1500);
  };

  const currentModeConfig = PLAY_MODES.find(m => m.mode === repeatMode) || PLAY_MODES[0];
  const hasLyrics = lyrics.length > 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => dispatch(setShowFullPlayer(false))} style={styles.hBtn} hitSlop={12}>
          <Icon name="chevron-down" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.hCenter}>
          <Text style={styles.hLabel}>正在播放</Text>
          <Text style={styles.hAlbum} numberOfLines={1}>{currentTrack.album}</Text>
        </View>
        <TouchableOpacity onPress={() => dispatch(toggleFavorite(currentTrack.id))} style={styles.hBtn} hitSlop={12}>
          <Icon
            name={currentTrack.isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={currentTrack.isFavorite ? COLORS.heart : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        {showLyrics ? (
          <View style={styles.lyricsContainer}>
            <TouchableOpacity onPress={() => dispatch(toggleShowLyrics())} style={styles.backToCoverBtn} activeOpacity={0.7}>
              <Icon name="image-outline" size={16} color={COLORS.accent} />
              <Text style={styles.backToCoverTxt}>封面</Text>
            </TouchableOpacity>
            <LyricsView />
          </View>
        ) : (
          <TouchableOpacity style={styles.coverArea} activeOpacity={0.95} onPress={() => hasLyrics && dispatch(toggleShowLyrics())}>
            <View style={styles.coverGlow}>
              <CoverArt artwork={currentTrack.artwork} size={COVER} borderRadius={SIZES.radiusXl} />
            </View>
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle} numberOfLines={2}>{currentTrack.title}</Text>
              <Text style={styles.trackArtist} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
            {hasLyrics && (
              <View style={styles.lyrHint}>
                <Icon name="document-text-outline" size={16} color={COLORS.accent} />
                <Text style={styles.lyrHintTxt}>点击查看歌词</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.controls}>
        <ProgressBar position={position} duration={duration} />
        <View style={styles.mainCtrl}>
          <TouchableOpacity onPress={cycleRepeat} style={styles.sideBtn}>
            <Icon name={currentModeConfig.icon} size={22} color={repeatMode !== 'off' ? COLORS.accent : COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToPrevious} style={styles.skipBtn}>
            <Icon name="play-skip-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn} activeOpacity={0.8}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={COLORS.bg} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipToNext} style={styles.skipBtn}>
            <Icon name="play-skip-forward" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowEQ(true)} style={styles.sideBtn}>
            <Icon name="options-outline" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {showModeToast !== '' && (
        <View style={styles.modeToast}>
          <Icon name={currentModeConfig.icon} size={16} color={COLORS.accent} />
          <Text style={styles.modeToastText}>{showModeToast}</Text>
        </View>
      )}

      <Equalizer visible={showEQ} onClose={() => setShowEQ(false)} />
    </View>
  );
};

/**
 * 应用播放模式到 TrackPlayer
 * 随机模式：重建队列为随机顺序，当前歌曲放在队首
 */
async function applyMode(mode: RepeatMode, currentTrack: any | null, allTracks: any[]) {
  try {
    if (mode === 'track') {
      await TrackPlayer.setRepeatMode(TPRepeatMode.Track);
    } else if (mode === 'queue') {
      // 随机模式：打乱队列
      await TrackPlayer.setRepeatMode(TPRepeatMode.Queue);
      if (currentTrack && allTracks.length > 1) {
        await reshuffleQueue(currentTrack);
      }
    } else {
      await TrackPlayer.setRepeatMode(TPRepeatMode.Off);
    }
  } catch {}
}

/**
 * 重新打乱 TrackPlayer 的播放队列，保持当前歌曲不变
 */
async function reshuffleQueue(currentTrack: any) {
  try {
    const queue = await TrackPlayer.getQueue();
    if (queue.length <= 1) return;

    const currentIdx = await TrackPlayer.getActiveTrackIndex();
    const pos = await TrackPlayer.getProgress();

    // 取出当前歌曲之后的所有歌曲
    const afterCurrent = queue.filter((_, i) => i !== currentIdx);
    const shuffled = shuffleArray(afterCurrent);

    // 重建队列：当前歌曲 + 打乱后的其余歌曲
    const current = queue[currentIdx!];
    await TrackPlayer.reset();
    await TrackPlayer.add([current, ...shuffled]);
    // 恢复播放位置
    await TrackPlayer.seekTo(pos.position);
    await TrackPlayer.play();
  } catch {}
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10 },
  hBtn: { padding: 8 },
  hCenter: { flex: 1, alignItems: 'center' },
  hLabel: { fontSize: SIZES.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
  hAlbum: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  main: { flex: 1 },
  lyricsContainer: { flex: 1 },
  backToCoverBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 4,
    borderRadius: 16, backgroundColor: COLORS.accentDim, gap: 6,
  },
  backToCoverTxt: { fontSize: SIZES.xs, color: COLORS.accent, fontWeight: '600' },
  coverArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  coverGlow: {
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 24, elevation: 12,
  },
  trackInfo: { alignItems: 'center', marginTop: 28, paddingHorizontal: 40 },
  trackTitle: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', lineHeight: 36 },
  trackArtist: { fontSize: SIZES.lg, color: COLORS.textSecondary, marginTop: 6 },
  lyrHint: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: COLORS.accentDim, gap: 6,
  },
  lyrHintTxt: { fontSize: SIZES.xs, color: COLORS.accent },
  controls: { paddingBottom: 40 },
  mainCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 16 },
  sideBtn: { padding: 10 },
  skipBtn: { padding: 12 },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  modeToast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.bgElevated,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  modeToastText: { fontSize: SIZES.sm, color: COLORS.accent, fontWeight: '600' },
});

export default memo(FullPlayerScreen);
