// src/screens/FullPlayerScreen.tsx
import React, { memo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar, Modal, Pressable, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
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
import AudioAnalyzer from '../components/AudioAnalyzer';
import { useAppSelector, useAppDispatch } from '../store';
import { setShowFullPlayer, toggleShowLyrics, toggleFavorite, setRepeatMode, setPlaybackSpeed, updateTrackArtwork } from '../store/musicSlice';
import { usePlayerControls, usePlayerSync } from '../hooks/usePlayerProgress';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { RepeatMode } from '../types';
import { hapticMedium, hapticLight, hapticSelection } from '../utils/haptics';
import { searchCoverArt, downloadCoverArt, downloadCoverToFile, CoverSearchResult } from '../utils/coverArtSearch';
import { writeTrackArtwork } from '../utils/tagWriter';

const COVER = Dimensions.get('window').width * 0.7;
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const PLAY_MODES: { mode: RepeatMode; icon: string; labelKey: string }[] = [
  { mode: 'off', icon: 'arrow-forward-outline', labelKey: 'fullPlayer.playModes.sequential' },
  { mode: 'queue', icon: 'shuffle-outline', labelKey: 'fullPlayer.playModes.shuffle' },
  { mode: 'track', icon: 'sync-outline', labelKey: 'fullPlayer.playModes.repeatOne' },
];

const FullPlayerScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { currentTrack, isPlaying, showLyrics, repeatMode, lyrics, playbackSpeed, sleepTimerEnd } = useAppSelector(s => s.music);
  const { togglePlayPause, skipToNext, skipToPrevious } = usePlayerControls();
  const { position, duration } = usePlayerSync();
  const { colors, sizes, isDark } = useTheme();
  const { t } = useTranslation();
  const [showEQ, setShowEQ] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showModeToast, setShowModeToast] = useState('');

  // Cover art search state
  const [showCoverSearch, setShowCoverSearch] = useState(false);
  const [coverSearching, setCoverSearching] = useState(false);
  const [coverResults, setCoverResults] = useState<CoverSearchResult[]>([]);
  const [coverSaving, setCoverSaving] = useState<number | null>(null);

  const handleSearchCover = useCallback(async () => {
    if (!currentTrack) return;
    setShowCoverSearch(true);
    setCoverSearching(true);
    setCoverResults([]);
    try {
      const results = await searchCoverArt(currentTrack.title, currentTrack.artist);
      setCoverResults(results);
    } catch {
      setCoverResults([]);
    } finally {
      setCoverSearching(false);
    }
  }, [currentTrack]);

  const handleSelectCover = useCallback(async (result: CoverSearchResult) => {
    if (!currentTrack) return;
    setCoverSaving(result.id);
    try {
      // Download and cache artwork
      const cachedUri = await downloadCoverArt(currentTrack.id, result.artworkUrl);
      if (!cachedUri) {
        Alert.alert(t('coverSearch.title'), t('coverSearch.downloadFailed'));
        setCoverSaving(null);
        return;
      }
      // Update Redux store
      dispatch(updateTrackArtwork({ trackId: currentTrack.id, artwork: cachedUri }));

      // Try writing artwork to file tags (best effort)
      const tmpPath = await downloadCoverToFile(result.artworkUrl);
      if (tmpPath) {
        await writeTrackArtwork(currentTrack.filePath, tmpPath).catch(() => {});
      }

      setShowCoverSearch(false);
    } catch {
      Alert.alert(t('coverSearch.title'), t('coverSearch.downloadFailed'));
    } finally {
      setCoverSaving(null);
    }
  }, [currentTrack, dispatch, t]);

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
    hapticLight();
    const idx = PLAY_MODES.findIndex(m => m.mode === repeatMode);
    const next = PLAY_MODES[(idx + 1) % PLAY_MODES.length];
    dispatch(setRepeatMode(next.mode));
    if (next.mode === 'track') await TrackPlayer.setRepeatMode(TPRepeatMode.Track);
    else if (next.mode === 'queue') await TrackPlayer.setRepeatMode(TPRepeatMode.Queue);
    else await TrackPlayer.setRepeatMode(TPRepeatMode.Off);
    try { await AsyncStorage.setItem('@playMode', JSON.stringify({ repeat: next.mode })); } catch {}
    setShowModeToast(t(next.labelKey)); setTimeout(() => setShowModeToast(''), 1500);
  };

  const changeSpeed = (spd: number) => { hapticSelection(); dispatch(setPlaybackSpeed(spd)); setShowSpeed(false); };

  const cfg = PLAY_MODES.find(m => m.mode === repeatMode) || PLAY_MODES[0];
  const hasTimer = sleepTimerEnd && sleepTimerEnd > Date.now();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hBtn} hitSlop={12} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="chevron-down" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.hCenter}>
          <Text style={{ fontSize: sizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 2 }}>{t('fullPlayer.header')}</Text>
          <Text style={{ fontSize: sizes.sm, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{headerTitle}</Text>
        </View>
        <TouchableOpacity onPress={() => { hapticLight(); dispatch(toggleFavorite(currentTrack.id)); }} style={styles.hBtn} hitSlop={12} accessibilityLabel={currentTrack.isFavorite ? 'Remove from favorites' : 'Add to favorites'} accessibilityRole="button">
          <Icon name={currentTrack.isFavorite ? 'heart' : 'heart-outline'} size={24} color={currentTrack.isFavorite ? colors.heart : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View style={styles.main}>
        {showLyrics ? (
          <View style={styles.lyricsContainer}>
            <TouchableOpacity onPress={() => dispatch(toggleShowLyrics())} style={[styles.backToCoverBtn, { backgroundColor: colors.accentDim }]} activeOpacity={0.7}>
              <Icon name="image-outline" size={16} color={colors.accent} /><Text style={{ fontSize: sizes.xs, color: colors.accent, fontWeight: '600' }}>{t('fullPlayer.coverButton')}</Text>
            </TouchableOpacity>
            <LyricsView />
          </View>
        ) : (
          <TouchableOpacity style={styles.coverArea} activeOpacity={0.95} onPress={() => dispatch(toggleShowLyrics())}>
            <View style={[styles.coverGlow, { shadowColor: colors.accent }]}><CoverArt artwork={currentTrack.artwork} size={COVER} borderRadius={28} /></View>
            {!currentTrack.artwork && (
              <TouchableOpacity
                style={[styles.coverSearchBtn, { backgroundColor: colors.accentDim }]}
                activeOpacity={0.7}
                onPress={handleSearchCover}>
                <Icon name="image-outline" size={16} color={colors.accent} />
                <Text style={{ fontSize: sizes.xs, color: colors.accent, fontWeight: '600' }}>{t('coverSearch.searchButton')}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.trackInfo}>
              <Text style={{ fontSize: sizes.xxl, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', lineHeight: 36 }} numberOfLines={2}>{currentTrack.title}</Text>
              <Text style={{ fontSize: sizes.lg, color: colors.textSecondary, marginTop: 6 }} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
            <View style={[styles.lyrHint, { backgroundColor: colors.accentDim }]}><Icon name="document-text-outline" size={16} color={colors.accent} /><Text style={{ fontSize: sizes.xs, color: colors.accent }}>{t('fullPlayer.lyricsHint')}</Text></View>
          </TouchableOpacity>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ProgressBar position={position} duration={duration} />

        <View style={styles.funcRow}>
          <TouchableOpacity onPress={() => setShowSleep(true)} style={styles.funcBtn} accessibilityLabel="Sleep timer" accessibilityRole="button">
            <Icon name={hasTimer ? 'moon' : 'moon-outline'} size={18} color={hasTimer ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSpeed(!showSpeed)} style={styles.funcBtn}>
            <Text style={[styles.speedLabel, { color: colors.textMuted }, playbackSpeed !== 1.0 && { color: colors.accent }]}>{playbackSpeed}x</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowQueue(true)} style={styles.funcBtn} accessibilityLabel="Play queue" accessibilityRole="button">
            <Icon name="list-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowEQ(true)} style={styles.funcBtn} accessibilityLabel="Equalizer" accessibilityRole="button">
            <Icon name="options-outline" size={18} color={colors.textMuted} />
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
          <TouchableOpacity onPress={cycleRepeat} style={styles.ctrlSideBtn} accessibilityLabel="Repeat mode" accessibilityRole="button">
            <Icon name={cfg.icon} size={22} color={repeatMode !== 'off' ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { hapticLight(); skipToPrevious(); }} style={styles.ctrlBtn} accessibilityLabel="Previous track" accessibilityRole="button">
            <Icon name="play-skip-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { hapticMedium(); togglePlayPause(); }} style={[styles.playBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]} activeOpacity={0.8} accessibilityLabel={isPlaying ? 'Pause' : 'Play'} accessibilityRole="button">
            <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={colors.bg} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { hapticLight(); skipToNext(); }} style={styles.ctrlBtn} accessibilityLabel="Next track" accessibilityRole="button">
            <Icon name="play-skip-forward" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMore(true)} style={styles.ctrlSideBtn}>
            <Icon name="ellipsis-horizontal" size={22} color={colors.textMuted} />
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

      {/* Audio Analyzer */}
      {showAnalyzer && (
        <Modal visible={showAnalyzer} transparent animationType="slide" onRequestClose={() => setShowAnalyzer(false)}>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10 }}>
              <TouchableOpacity onPress={() => setShowAnalyzer(false)} style={styles.hBtn} hitSlop={12}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: sizes.lg, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>{t('fullPlayer.moreMenu.audioAnalyzer')}</Text>
              <View style={styles.hBtn} />
            </View>
            <AudioAnalyzer />
          </View>
        </Modal>
      )}

      {/* More menu */}
      {showMore && (
        <Modal visible={showMore} transparent animationType="fade" onRequestClose={() => setShowMore(false)}>
          <Pressable style={[styles.moreOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowMore(false)}>
            <Pressable style={[styles.moreSheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
              <View style={styles.moreHeader}>
                <Text style={{ fontSize: sizes.xl, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{t('fullPlayer.moreMenu.title')}</Text>
                <TouchableOpacity onPress={() => setShowMore(false)} hitSlop={12}>
                  <Icon name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.moreItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => { setShowMore(false); navigation.navigate('RhythmLight' as never); }}>
                <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                  <Icon name="pulse-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>{t('fullPlayer.moreMenu.rhythmLight')}</Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>{t('fullPlayer.moreMenu.rhythmLightDesc')}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => { setShowMore(false); navigation.navigate('CarMode' as never); }}>
                <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                  <Icon name="car-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>{t('fullPlayer.moreMenu.carMode')}</Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>{t('fullPlayer.moreMenu.carModeDesc')}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => { setShowMore(false); setShowAnalyzer(true); }}>
                <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                  <Icon name="analytics-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>{t('fullPlayer.moreMenu.audioAnalyzer')}</Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>{t('fullPlayer.moreMenu.audioAnalyzerDesc')}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Cover Art Search Modal */}
      {showCoverSearch && (
        <Modal visible={showCoverSearch} transparent animationType="slide" onRequestClose={() => setShowCoverSearch(false)}>
          <Pressable style={[styles.moreOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowCoverSearch(false)}>
            <Pressable style={[styles.coverSearchSheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
              <View style={styles.moreHeader}>
                <Text style={{ fontSize: sizes.xl, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{t('coverSearch.title')}</Text>
                <TouchableOpacity onPress={() => setShowCoverSearch(false)} hitSlop={12}>
                  <Icon name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {currentTrack && (
                <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginBottom: 12 }} numberOfLines={1}>
                  {currentTrack.artist} - {currentTrack.title}
                </Text>
              )}
              {coverSearching ? (
                <View style={styles.coverSearchCenter}>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={{ fontSize: sizes.md, color: colors.textMuted, marginTop: 12 }}>{t('coverSearch.searching')}</Text>
                </View>
              ) : coverResults.length === 0 ? (
                <View style={styles.coverSearchCenter}>
                  <Icon name="image-outline" size={48} color={colors.textMuted} />
                  <Text style={{ fontSize: sizes.md, color: colors.textMuted, marginTop: 12 }}>{t('coverSearch.noResults')}</Text>
                </View>
              ) : (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.coverGrid}>
                    {coverResults.map(r => {
                      const isSaving = coverSaving === r.id;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[styles.coverResultItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                          activeOpacity={0.7}
                          onPress={() => !coverSaving && handleSelectCover(r)}
                          disabled={!!coverSaving}>
                          <Image source={{ uri: r.thumbUrl }} style={styles.coverThumb} resizeMode="cover" />
                          {isSaving && (
                            <View style={styles.coverSavingOverlay}>
                              <ActivityIndicator size="small" color="#fff" />
                            </View>
                          )}
                          <Text style={{ fontSize: 11, color: colors.textPrimary, marginTop: 4, fontWeight: '600' }} numberOfLines={1}>{r.title}</Text>
                          <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{r.artist}</Text>
                          <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{r.album}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  moreOverlay: { flex: 1, justifyContent: 'flex-end' },
  moreSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  moreHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  moreItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  moreItemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  coverSearchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  coverSearchSheet: { maxHeight: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  coverSearchCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  coverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 20 },
  coverResultItem: { width: (Dimensions.get('window').width - 40 - 24) / 3, borderRadius: 12, padding: 8, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  coverThumb: { width: '100%', aspectRatio: 1, borderRadius: 8 } as any,
  coverSavingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

export default memo(FullPlayerScreen);
