// src/screens/FullPlayerScreen.tsx
import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, { RepeatMode as TPRepeatMode } from 'react-native-track-player';
import { useNavigation } from '@react-navigation/native';
import CoverArt from '../components/CoverArt';
import MarqueeText from '../components/MarqueeText';
import ProgressBar from '../components/ProgressBar';
import LyricsView from '../components/LyricsView';
import Equalizer from '../components/Equalizer';
import SleepTimer from '../components/SleepTimer';
import PlayQueueView from '../components/PlayQueueView';
import AudioAnalyzer from '../components/AudioAnalyzer';
import { useAppSelector, useAppDispatch } from '../store';
import {
  setShowFullPlayer,
  toggleShowLyrics,
  toggleFavorite,
  setRepeatMode,
  setPlaybackSpeed,
  updateTrackArtwork,
  setLyricsOffset,
} from '../store/musicSlice';
import { usePlayerControls, usePlayerSync } from '../hooks/usePlayerProgress';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { RepeatMode } from '../types';
import { hapticMedium, hapticLight, hapticSelection } from '../utils/haptics';
import RNFS from 'react-native-fs';
import { searchAndApplyCover } from '../utils/coverArtSearch';
import { getCachedArtwork } from '../utils/artworkCache';

const COVER = Dimensions.get('window').width * 0.84;
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// 是否启用封面搜索功能（需要联网）
const COVER_SEARCH_ENABLED = false;

const OFFSET_STEP = 0.1; // seconds

const PLAY_MODES: { mode: RepeatMode; icon: string; labelKey: string }[] = [
  { mode: 'off', icon: 'arrow-forward-outline', labelKey: 'fullPlayer.playModes.sequential' },
  { mode: 'queue', icon: 'shuffle-outline', labelKey: 'fullPlayer.playModes.shuffle' },
  { mode: 'track', icon: 'sync-outline', labelKey: 'fullPlayer.playModes.repeatOne' },
];

const FullPlayerScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { currentTrack, isPlaying, showLyrics, repeatMode, playbackSpeed, sleepTimerEnd } =
    useAppSelector(s => s.music);
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
  const [showOffsetBar, setShowOffsetBar] = useState(false);

  // Lyrics offset from Redux
  const lyricsOffset = useAppSelector(s => s.music.lyricsOffset);

  // Cover art search state
  const [showCoverSearch, setShowCoverSearch] = useState(false);
  const [coverSearching, setCoverSearching] = useState(false);
  const [coverArtist, setCoverArtist] = useState<string>('');
  // Determine the best search query for cover art
  const getCoverSearchQuery = useCallback(() => {
    if (!currentTrack) {
      return '';
    }
    const artist = currentTrack.artist || '';
    const isUnknown =
      !artist ||
      artist === t('common.unknownArtist') ||
      artist === 'Unknown Artist' ||
      artist === '未知歌手';
    return isUnknown ? currentTrack.title || '' : artist;
  }, [currentTrack, t]);

  // Load per-track lyrics offset
  useEffect(() => {
    if (!currentTrack?.id) {
      return;
    }
    (async () => {
      try {
        const val = await AsyncStorage.getItem(`@lyricOffset_${currentTrack.id}`);
        dispatch(setLyricsOffset(val ? parseFloat(val) : 0));
      } catch {
        dispatch(setLyricsOffset(0));
      }
    })();
  }, [currentTrack?.id, dispatch]);

  const adjustOffset = useCallback(
    (delta: number) => {
      const next = Math.round((lyricsOffset + delta) * 10) / 10;
      dispatch(setLyricsOffset(next));
      if (currentTrack?.id) {
        AsyncStorage.setItem(`@lyricOffset_${currentTrack.id}`, String(next)).catch(() => {});
      }
    },
    [lyricsOffset, currentTrack?.id, dispatch],
  );

  const resetOffset = useCallback(() => {
    dispatch(setLyricsOffset(0));
    if (currentTrack?.id) {
      AsyncStorage.removeItem(`@lyricOffset_${currentTrack.id}`).catch(() => {});
    }
  }, [currentTrack?.id, dispatch]);

  // 打开封面搜索弹窗（不自动搜索）
  const handleSearchCover = useCallback(() => {
    if (!currentTrack) {
      return;
    }
    const query = getCoverSearchQuery();
    setCoverArtist(query);
    setShowCoverSearch(true);
  }, [currentTrack, getCoverSearchQuery]);

  // 搜索封面并自动替换
  const doCoverSearch = useCallback(
    async (artist: string) => {
      if (!currentTrack) {
        return;
      }
      setCoverSearching(true);
      try {
        // Delete old album cache cover if it exists (not embedded artwork)
        if (currentTrack.artwork && currentTrack.artwork.startsWith('file://')) {
          const artPath = currentTrack.artwork.replace('file://', '');
          // Only delete if it's in the album cache directory
          if (artPath.includes('/album/')) {
            try {
              await RNFS.unlink(artPath);
            } catch {}
          }
        }
        const result = await searchAndApplyCover(currentTrack.id, artist);
        if (result) {
          dispatch(updateTrackArtwork({ trackId: currentTrack.id, artwork: result.cachedUri }));
          if (result.tmpPath) {
            RNFS.unlink(result.tmpPath).catch(() => {});
          }
          setShowCoverSearch(false);
          Alert.alert(t('coverSearch.title'), t('coverSearch.applySuccess'));
        } else {
          Alert.alert(t('coverSearch.title'), t('coverSearch.noResults'));
        }
      } catch {
        Alert.alert(t('coverSearch.title'), t('coverSearch.downloadFailed'));
      } finally {
        setCoverSearching(false);
      }
    },
    [currentTrack, dispatch, t],
  );

  // 关闭封面搜索弹窗
  const handleCloseCoverSearch = useCallback(() => {
    setShowCoverSearch(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@playMode');
        if (saved) {
          const p = JSON.parse(saved);
          dispatch(setRepeatMode(p.repeat || 'off'));
        }
      } catch {}
    })();
  }, [dispatch]);

  // Auto-download cover art: search Bing when track has no artwork.
  // Uses file-copy approach (zero base64) to avoid Android OOM crashes.
  const autoDownloadAttemptedRef = React.useRef<Set<string>>(new Set());
  const autoDownloadActiveRef = React.useRef(false);

  useEffect(() => {
    if (!COVER_SEARCH_ENABLED || !currentTrack?.id) {
      return;
    }
    if (currentTrack.artwork) {
      return;
    }
    if (autoDownloadAttemptedRef.current.has(currentTrack.id)) {
      return;
    }

    autoDownloadAttemptedRef.current.add(currentTrack.id);
    const trackId = currentTrack.id;
    const artist = currentTrack.artist || '';
    const isUnknown = !artist || artist === 'Unknown Artist' || artist === '未知歌手';
    const query = isUnknown ? currentTrack.title || '' : artist;
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) {
        return;
      }
      try {
        const cached = await getCachedArtwork(trackId);
        if (cached && !cancelled) {
          dispatch(updateTrackArtwork({ trackId, artwork: cached }));
          return;
        }
      } catch {}

      if (cancelled || !query.trim() || autoDownloadActiveRef.current) {
        return;
      }
      autoDownloadActiveRef.current = true;

      try {
        const result = await searchAndApplyCover(trackId, query);
        if (result && !cancelled) {
          dispatch(updateTrackArtwork({ trackId, artwork: result.cachedUri }));
          if (result.tmpPath) {
            RNFS.unlink(result.tmpPath).catch(() => {});
          }
        }
      } catch {
        // Silently fail — never crash
      } finally {
        autoDownloadActiveRef.current = false;
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentTrack?.id, currentTrack?.artwork, dispatch]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      dispatch(setShowFullPlayer(false));
    });
    return unsub;
  }, [navigation, dispatch]);

  const closePlayer = useCallback(() => {
    dispatch(setShowFullPlayer(false));
    navigation.goBack();
  }, [dispatch, navigation]);

  const topAreaPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => !showLyrics && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (!showLyrics && g.dy > 64 && g.vy > 0.2) {
            closePlayer();
          }
        },
      }),
    [showLyrics, closePlayer],
  );

  if (!currentTrack) {
    return null;
  }

  const cycleRepeat = async () => {
    hapticLight();
    const idx = PLAY_MODES.findIndex(m => m.mode === repeatMode);
    const next = PLAY_MODES[(idx + 1) % PLAY_MODES.length];
    dispatch(setRepeatMode(next.mode));
    if (next.mode === 'track') {
      await TrackPlayer.setRepeatMode(TPRepeatMode.Track);
    } else if (next.mode === 'queue') {
      await TrackPlayer.setRepeatMode(TPRepeatMode.Queue);
    } else {
      await TrackPlayer.setRepeatMode(TPRepeatMode.Off);
    }
    try {
      await AsyncStorage.setItem('@playMode', JSON.stringify({ repeat: next.mode }));
    } catch {}
    setShowModeToast(t(next.labelKey));
    setTimeout(() => setShowModeToast(''), 1500);
  };

  const changeSpeed = (spd: number) => {
    hapticSelection();
    dispatch(setPlaybackSpeed(spd));
    setShowSpeed(false);
  };

  const cfg = PLAY_MODES.find(m => m.mode === repeatMode) || PLAY_MODES[0];
  const hasTimer = sleepTimerEnd && sleepTimerEnd > Date.now();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <View style={styles.topArea} {...topAreaPanResponder.panHandlers}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={closePlayer}
            style={styles.hBtn}
            hitSlop={12}
            accessibilityLabel="Go back"
            accessibilityRole="button">
            <Icon name="chevron-down" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={styles.hBtn} />
        </View>

        {/* Main */}
        <View style={styles.main}>
        {showLyrics ? (
          <View style={styles.lyricsContainer}>
            <LyricsView />
          </View>
        ) : (
          <View style={styles.coverArea}>
            <View style={[styles.coverGlow, { shadowColor: colors.accent }]}>
              <CoverArt artwork={currentTrack.artwork} size={COVER} borderRadius={28} />
            </View>
            <View style={styles.trackInfo}>
              <MarqueeText
                text={currentTrack.title || currentTrack.fileName.replace(/\.[^.]+$/, '')}
                style={{
                  fontSize: sizes.xl,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  textAlign: 'center',
                }}
              />
              <Text
                style={{ fontSize: sizes.lg, color: colors.textSecondary, marginTop: 6 }}
                numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
          </View>
        )}
        </View>

        {/* Lyrics Offset Bar */}
        {showOffsetBar && showLyrics && (
          <View
            style={[
              styles.offsetBar,
              { backgroundColor: colors.bgElevated, borderColor: colors.border },
            ]}>
          <Text style={{ fontSize: sizes.sm, color: colors.textSecondary, fontWeight: '600' }}>
            {t('lyrics.offset.title')}
          </Text>
          <TouchableOpacity
            onPress={() => adjustOffset(-OFFSET_STEP)}
            style={[styles.offsetBtn, { backgroundColor: colors.bgCard }]}>
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '700' }}>
              -
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              fontSize: sizes.md,
              color: colors.accent,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              minWidth: 60,
              textAlign: 'center',
            }}>
            {lyricsOffset >= 0 ? '+' : ''}
            {lyricsOffset.toFixed(1)}s
          </Text>
          <TouchableOpacity
            onPress={() => adjustOffset(OFFSET_STEP)}
            style={[styles.offsetBtn, { backgroundColor: colors.bgCard }]}>
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '700' }}>
              +
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resetOffset} style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: sizes.sm, color: colors.textMuted }}>
              {t('lyrics.offset.reset')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowOffsetBar(false)}
            style={{ marginLeft: 'auto', padding: 4 }}>
            <Icon name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ProgressBar position={position} duration={duration} />

        <View style={styles.funcRow}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              dispatch(toggleFavorite(currentTrack.id));
            }}
            style={styles.funcBtn}
            accessibilityLabel={
              currentTrack.isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            accessibilityRole="button">
            <Icon
              name={currentTrack.isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={currentTrack.isFavorite ? colors.heart : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSleep(true)}
            style={styles.funcBtn}
            accessibilityLabel="Sleep timer"
            accessibilityRole="button">
            <Icon
              name={hasTimer ? 'moon' : 'moon-outline'}
              size={18}
              color={hasTimer ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSpeed(!showSpeed)} style={styles.funcBtn}>
            <Text
              style={[
                styles.speedLabel,
                { color: colors.textMuted },
                playbackSpeed !== 1.0 && { color: colors.accent },
              ]}>
              {playbackSpeed}x
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowEQ(true)}
            style={styles.funcBtn}
            accessibilityLabel="Equalizer"
            accessibilityRole="button">
            <Icon name="options-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              dispatch(toggleShowLyrics());
            }}
            style={styles.funcBtn}
            accessibilityLabel={showLyrics ? 'Show cover' : 'Show lyrics'}
            accessibilityRole="button">
            <Icon
              name={showLyrics ? 'image-outline' : 'document-text-outline'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowQueue(true)}
            style={styles.funcBtn}
            accessibilityLabel="Play queue"
            accessibilityRole="button">
            <Icon name="list-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {showSpeed && (
          <View style={styles.speedRow}>
            {SPEEDS.map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.speedBtn,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                  playbackSpeed === s && {
                    backgroundColor: colors.accent,
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => changeSpeed(s)}>
                <Text
                  style={[
                    styles.speedBtnTxt,
                    { color: colors.textMuted },
                    playbackSpeed === s && { color: colors.bg },
                  ]}>
                  {s}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.mainCtrl}>
          <View style={styles.ctrlSideBtn}>
            {showModeToast !== '' && (
              <View style={styles.modeToast}>
                <View
                  style={[
                    styles.modeToastInner,
                    { backgroundColor: colors.bgElevated, borderColor: colors.border },
                  ]}>
                  <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>
                    {showModeToast}
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              onPress={cycleRepeat}
              accessibilityLabel="Repeat mode"
              accessibilityRole="button">
              <Icon
                name={cfg.icon}
                size={22}
                color={repeatMode !== 'off' ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              skipToPrevious();
            }}
            style={styles.ctrlBtn}
            accessibilityLabel="Previous track"
            accessibilityRole="button">
            <Icon name="play-skip-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticMedium();
              togglePlayPause();
            }}
            style={[styles.playBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
            activeOpacity={0.8}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityRole="button">
            <Icon
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color={colors.bg}
              style={isPlaying ? undefined : { marginLeft: 3 }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              skipToNext();
            }}
            style={styles.ctrlBtn}
            accessibilityLabel="Next track"
            accessibilityRole="button">
            <Icon name="play-skip-forward" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowMore(true)}
            style={styles.ctrlSideBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon name="ellipsis-horizontal" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <Equalizer visible={showEQ} onClose={() => setShowEQ(false)} />
      <SleepTimer visible={showSleep} onClose={() => setShowSleep(false)} />
      <PlayQueueView visible={showQueue} onClose={() => setShowQueue(false)} />

      {/* Audio Analyzer */}
      {showAnalyzer && (
        <Modal
          visible={showAnalyzer}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAnalyzer(false)}>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: 50,
                paddingBottom: 10,
              }}>
              <TouchableOpacity
                onPress={() => setShowAnalyzer(false)}
                style={styles.hBtn}
                hitSlop={12}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text
                style={{
                  flex: 1,
                  fontSize: sizes.lg,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  textAlign: 'center',
                }}>
                {t('fullPlayer.moreMenu.audioAnalyzer')}
              </Text>
              <View style={styles.hBtn} />
            </View>
            <AudioAnalyzer />
          </View>
        </Modal>
      )}

      {/* More menu */}
      {showMore && (
        <Modal
          visible={showMore}
          transparent
          animationType="none"
          onRequestClose={() => setShowMore(false)}>
          <Pressable
            style={[styles.moreOverlay, { backgroundColor: colors.overlay }]}
            onPress={() => setShowMore(false)}>
            <Pressable
              style={[styles.moreSheet, { backgroundColor: colors.bgElevated }]}
              onPress={() => {}}>
              <View style={styles.moreHeader}>
                <Text
                  style={{
                    fontSize: sizes.xl,
                    fontWeight: '700',
                    color: colors.textPrimary,
                    flex: 1,
                  }}>
                  {t('fullPlayer.moreMenu.title')}
                </Text>
                <TouchableOpacity onPress={() => setShowMore(false)} hitSlop={12}>
                  <Icon name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.moreItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  navigation.navigate('RhythmLight' as never);
                }}>
                <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                  <Icon name="pulse-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
                    {t('fullPlayer.moreMenu.rhythmLight')}
                  </Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                    {t('fullPlayer.moreMenu.rhythmLightDesc')}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  navigation.navigate('CarMode' as never);
                }}>
                <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                  <Icon name="car-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
                    {t('fullPlayer.moreMenu.carMode')}
                  </Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                    {t('fullPlayer.moreMenu.carModeDesc')}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  setShowAnalyzer(true);
                }}>
                <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                  <Icon name="analytics-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
                    {t('fullPlayer.moreMenu.audioAnalyzer')}
                  </Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                    {t('fullPlayer.moreMenu.audioAnalyzerDesc')}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {COVER_SEARCH_ENABLED && (
                <TouchableOpacity
                  style={[styles.moreItem, { borderBottomColor: colors.border }]}
                  activeOpacity={0.6}
                  onPress={() => {
                    setShowMore(false);
                    handleSearchCover();
                  }}>
                  <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                    <Icon name="image-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
                      {t('fullPlayer.moreMenu.searchCover')}
                    </Text>
                    <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                      {t('fullPlayer.moreMenu.searchCoverDesc')}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.moreItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  if (showLyrics) {
                    setShowOffsetBar(v => !v);
                  } else {
                    dispatch(toggleShowLyrics());
                    setShowOffsetBar(true);
                  }
                }}>
                <View style={[styles.moreItemIcon, { backgroundColor: colors.accentDim }]}>
                  <Icon name="timer-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
                    {t('fullPlayer.moreMenu.lyricsOffset')}
                  </Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                    {t('fullPlayer.moreMenu.lyricsOffsetDesc')}
                  </Text>
                </View>
                {lyricsOffset !== 0 && (
                  <Text
                    style={{
                      fontSize: sizes.sm,
                      color: colors.accent,
                      fontWeight: '600',
                      marginRight: 8,
                    }}>
                    {lyricsOffset >= 0 ? '+' : ''}
                    {lyricsOffset.toFixed(1)}s
                  </Text>
                )}
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Cover Art Search Modal */}
      {COVER_SEARCH_ENABLED && showCoverSearch && (
        <Modal
          visible={showCoverSearch}
          transparent
          animationType="none"
          onRequestClose={handleCloseCoverSearch}>
          <Pressable
            style={[styles.moreOverlay, { backgroundColor: colors.overlay }]}
            onPress={handleCloseCoverSearch}>
            <Pressable
              style={[styles.coverSearchSheet, { backgroundColor: colors.bgElevated }]}
              onPress={() => {}}>
              <View style={styles.moreHeader}>
                <Text
                  style={{
                    fontSize: sizes.xl,
                    fontWeight: '700',
                    color: colors.textPrimary,
                    flex: 1,
                  }}>
                  {t('coverSearch.title')}
                </Text>
                <TouchableOpacity onPress={handleCloseCoverSearch} hitSlop={12}>
                  <Icon name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {/* 歌手名输入框和搜索按钮 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginRight: 8 }}>
                  {t('coverSearch.artistLabel') || '歌手名'}
                </Text>
                <View
                  style={{
                    flex: 1,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                    marginRight: 8,
                  }}>
                  <TextInput
                    style={{ fontSize: sizes.md, color: colors.textPrimary, paddingVertical: 2 }}
                    value={coverArtist}
                    onChangeText={setCoverArtist}
                    placeholder={t('coverSearch.artistPlaceholder') || '请输入歌手名'}
                    editable={!coverSearching}
                  />
                </View>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: colors.accent,
                    borderRadius: 8,
                  }}
                  onPress={() => doCoverSearch(coverArtist)}
                  disabled={coverSearching || !coverArtist.trim()}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {t('coverSearch.searchButton')}
                  </Text>
                </TouchableOpacity>
              </View>
              {coverSearching && (
                <View style={styles.coverSearchCenter}>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={{ fontSize: sizes.md, color: colors.textMuted, marginTop: 12 }}>
                    {t('coverSearch.searching')}
                  </Text>
                </View>
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
  topArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
  },
  hBtn: { padding: 8, width: 44, alignItems: 'center' },
  hCenter: { flex: 1, alignItems: 'center' },
  main: { flex: 1 },
  lyricsContainer: { flex: 1 },
  backToCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 4,
    borderRadius: 16,
    gap: 6,
  },
  coverArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
  coverGlow: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  trackInfo: { alignItems: 'center', marginTop: 36, paddingHorizontal: 40 },
  lyrHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  controls: { paddingBottom: 34 },
  offsetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
  },
  offsetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  funcRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
    marginBottom: 4,
  },
  funcBtn: { padding: 8 },
  speedLabel: { fontSize: 12, fontWeight: '700' },
  speedRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  speedBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  speedBtnTxt: { fontSize: 12, fontWeight: '600' },
  mainCtrl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    overflow: 'visible',
  },
  ctrlSideBtn: { width: 48, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  ctrlBtn: { width: 56, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modeToast: {
    position: 'absolute',
    bottom: 26,
    left: -30,
    right: -30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modeToastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  moreOverlay: { flex: 1, justifyContent: 'flex-end' },
  moreSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  moreHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moreItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  coverSearchSheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  coverSearchCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  coverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 20 },
  coverResultItem: {
    width: (Dimensions.get('window').width - 40 - 24) / 3,
    borderRadius: 12,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  coverThumb: { width: '100%', aspectRatio: 1, borderRadius: 8 } as any,
  coverSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});

export default memo(FullPlayerScreen);
