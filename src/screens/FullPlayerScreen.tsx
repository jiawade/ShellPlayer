// src/screens/FullPlayerScreen.tsx
import React, {memo, useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer, {RepeatMode as TPRepeatMode} from 'react-native-track-player';
import {useNavigation} from '@react-navigation/native';
import CoverArt from '../components/CoverArt';
import ProgressBar from '../components/ProgressBar';
import LyricsView from '../components/LyricsView';
import Equalizer from '../components/Equalizer';
import SleepTimer from '../components/SleepTimer';
import PlayQueueView from '../components/PlayQueueView';
import AudioAnalyzer from '../components/AudioAnalyzer';
import {useAppSelector, useAppDispatch} from '../store';
import {
  setShowFullPlayer,
  toggleShowLyrics,
  toggleFavorite,
  setRepeatMode,
  setPlaybackSpeed,
  updateTrackArtwork,
  setLyricsOffset,
} from '../store/musicSlice';
import {usePlayerControls, usePlayerSync} from '../hooks/usePlayerProgress';
import {useTheme} from '../contexts/ThemeContext';
import {useTranslation} from 'react-i18next';
import {RepeatMode} from '../types';
import {hapticMedium, hapticLight, hapticSelection} from '../utils/haptics';
import {
  searchCoverArt,
  downloadCoverArt,
  downloadCoverToFile,
  searchAndApplyCover,
  CoverSearchResult,
} from '../utils/coverArtSearch';
import {writeTrackArtwork} from '../utils/tagWriter';

const COVER = Dimensions.get('window').width * 0.7;
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// Feature flag: Bing image scraping has copyright/ToS risk for App Store/Google Play.
// Set to true to re-enable cover search & auto-download.
const COVER_SEARCH_ENABLED = true;

const OFFSET_STEP = 0.1; // seconds

const PLAY_MODES: {mode: RepeatMode; icon: string; labelKey: string}[] = [
  {mode: 'off', icon: 'arrow-forward-outline', labelKey: 'fullPlayer.playModes.sequential'},
  {mode: 'queue', icon: 'shuffle-outline', labelKey: 'fullPlayer.playModes.shuffle'},
  {mode: 'track', icon: 'sync-outline', labelKey: 'fullPlayer.playModes.repeatOne'},
];

const FullPlayerScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const {currentTrack, isPlaying, showLyrics, repeatMode, lyrics, playbackSpeed, sleepTimerEnd} =
    useAppSelector(s => s.music);
  const {togglePlayPause, skipToNext, skipToPrevious} = usePlayerControls();
  const {position, duration} = usePlayerSync();
  const {colors, sizes, isDark} = useTheme();
  const {t} = useTranslation();
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
  const [coverResults, setCoverResults] = useState<CoverSearchResult[]>([]);
  const [coverSaving, setCoverSaving] = useState(false);
  const [coverArtist, setCoverArtist] = useState<string>('');
  const [selectedCoverId, setSelectedCoverId] = useState<number | null>(null);
  // Determine the best search query for cover art
  const getCoverSearchQuery = useCallback(() => {
    if (!currentTrack) return '';
    const artist = currentTrack.artist || '';
    const isUnknown = !artist || artist === t('common.unknownArtist') || artist === 'Unknown Artist' || artist === '未知歌手';
    return isUnknown ? (currentTrack.title || '') : artist;
  }, [currentTrack, t]);

  // Load per-track lyrics offset
  useEffect(() => {
    if (!currentTrack?.id) return;
    (async () => {
      try {
        const val = await AsyncStorage.getItem(`@lyricOffset_${currentTrack.id}`);
        dispatch(setLyricsOffset(val ? parseFloat(val) : 0));
      } catch {
        dispatch(setLyricsOffset(0));
      }
    })();
  }, [currentTrack?.id, dispatch]);

  const adjustOffset = useCallback((delta: number) => {
    const next = Math.round((lyricsOffset + delta) * 10) / 10;
    dispatch(setLyricsOffset(next));
    if (currentTrack?.id) {
      AsyncStorage.setItem(`@lyricOffset_${currentTrack.id}`, String(next)).catch(() => {});
    }
  }, [lyricsOffset, currentTrack?.id, dispatch]);

  const resetOffset = useCallback(() => {
    dispatch(setLyricsOffset(0));
    if (currentTrack?.id) {
      AsyncStorage.removeItem(`@lyricOffset_${currentTrack.id}`).catch(() => {});
    }
  }, [currentTrack?.id, dispatch]);

  // 打开封面搜索弹窗并自动搜索
  const handleSearchCover = useCallback(() => {
    if (!currentTrack) {
      return;
    }
    const query = getCoverSearchQuery();
    setCoverArtist(query);
    setShowCoverSearch(true);
    setCoverResults([]);
    setSelectedCoverId(null);
    // 自动触发搜索
    if (query.trim()) {
      setCoverSearching(true);
      searchCoverArt(query).then(results => {
        setCoverResults(results);
      }).catch(() => {
        setCoverResults([]);
      }).finally(() => {
        setCoverSearching(false);
      });
    }
  }, [currentTrack, getCoverSearchQuery]);

  // 搜索封面（仅搜索，展示结果，不自动应用）
  const doCoverSearch = useCallback(
    async (artist: string) => {
      if (!currentTrack) {
        return;
      }
      setCoverSearching(true);
      setCoverResults([]);
      setSelectedCoverId(null);
      try {
        const results = await searchCoverArt(artist);
        setCoverResults(results);
      } catch {
        setCoverResults([]);
      } finally {
        setCoverSearching(false);
      }
    },
    [currentTrack],
  );

  // 关闭封面搜索弹窗：如果已选中封面，下载并应用
  const handleCloseCoverSearch = useCallback(
    async () => {
      if (!currentTrack || selectedCoverId === null) {
        setShowCoverSearch(false);
        return;
      }
      const selected = coverResults.find(r => r.id === selectedCoverId);
      if (!selected) {
        setShowCoverSearch(false);
        return;
      }
      setCoverSaving(true);
      try {
        const cachedUri = await downloadCoverArt(currentTrack.id, selected.artworkUrl);
        if (!cachedUri) {
          Alert.alert(t('coverSearch.title'), t('coverSearch.downloadFailed'));
          setCoverSaving(false);
          return;
        }
        dispatch(updateTrackArtwork({trackId: currentTrack.id, artwork: cachedUri}));

        if (Platform.OS !== 'ios') {
          const tmpPath = await downloadCoverToFile(selected.artworkUrl);
          if (tmpPath) {
            await writeTrackArtwork(currentTrack.filePath, tmpPath).catch(() => false);
          }
        }

        setShowCoverSearch(false);
        Alert.alert(t('coverSearch.title'), t('coverSearch.applySuccess'));
      } catch {
        Alert.alert(t('coverSearch.title'), t('coverSearch.downloadFailed'));
      } finally {
        setCoverSaving(false);
      }
    },
    [currentTrack, selectedCoverId, coverResults, dispatch, t],
  );

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

  // Auto-download cover art when entering FullPlayer if track has no artwork
  const autoDownloadAttemptedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!COVER_SEARCH_ENABLED) return;
    if (!currentTrack) return;
    if (currentTrack.artwork) return;
    if (autoDownloadAttemptedRef.current === currentTrack.id) return;
    autoDownloadAttemptedRef.current = currentTrack.id;

    const query = getCoverSearchQuery();
    if (!query) return;

    (async () => {
      try {
        const autoResult = await searchAndApplyCover(currentTrack.id, query);
        if (autoResult) {
          dispatch(updateTrackArtwork({trackId: currentTrack.id, artwork: autoResult.cachedUri}));
          if (Platform.OS !== 'ios' && autoResult.tmpPath) {
            await writeTrackArtwork(currentTrack.filePath, autoResult.tmpPath).catch(() => {});
          }
        }
      } catch {}
    })();
  }, [currentTrack?.id, currentTrack?.artwork, dispatch, getCoverSearchQuery]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      dispatch(setShowFullPlayer(false));
    });
    return unsub;
  }, [navigation, dispatch]);

  if (!currentTrack) {
    return null;
  }

  const headerTitle = (() => {
    const hasArtist =
      currentTrack.artist &&
      currentTrack.artist !== t('common.unknownArtist') &&
      currentTrack.artist !== 'Unknown Artist' &&
      currentTrack.artist !== '未知歌手';
    const hasTitle = currentTrack.title && currentTrack.title !== currentTrack.fileName;
    if (hasArtist && hasTitle) {
      return `${currentTrack.artist} - ${currentTrack.title}`;
    }
    if (hasTitle) {
      return currentTrack.title;
    }
    if (hasArtist) {
      return currentTrack.artist;
    }
    return currentTrack.fileName;
  })();

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
      await AsyncStorage.setItem('@playMode', JSON.stringify({repeat: next.mode}));
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
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.hBtn}
          hitSlop={12}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Icon name="chevron-down" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.hCenter}>
          <Text
            style={{
              fontSize: sizes.xs,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}>
            {t('fullPlayer.header')}
          </Text>
          <Text
            style={{fontSize: sizes.sm, color: colors.textSecondary, marginTop: 2}}
            numberOfLines={1}>
            {headerTitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            dispatch(toggleFavorite(currentTrack.id));
          }}
          style={styles.hBtn}
          hitSlop={12}
          accessibilityLabel={
            currentTrack.isFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          accessibilityRole="button">
          <Icon
            name={currentTrack.isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={currentTrack.isFavorite ? colors.heart : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View style={styles.main}>
        {showLyrics ? (
          <View style={styles.lyricsContainer}>
            <TouchableOpacity
              onPress={() => dispatch(toggleShowLyrics())}
              style={[styles.backToCoverBtn, {backgroundColor: colors.accentDim}]}
              activeOpacity={0.7}>
              <Icon name="image-outline" size={16} color={colors.accent} />
              <Text style={{fontSize: sizes.xs, color: colors.accent, fontWeight: '600'}}>
                {t('fullPlayer.coverButton')}
              </Text>
            </TouchableOpacity>
            <LyricsView />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.coverArea}
            activeOpacity={0.95}
            onPress={() => dispatch(toggleShowLyrics())}>
            <View style={[styles.coverGlow, {shadowColor: colors.accent}]}>
              <CoverArt artwork={currentTrack.artwork} size={COVER} borderRadius={28} />
            </View>
            <View style={styles.trackInfo}>
              <Text
                style={{
                  fontSize: sizes.xxl,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  textAlign: 'center',
                  lineHeight: 36,
                }}
                numberOfLines={2}>
                {currentTrack.title}
              </Text>
              <Text
                style={{fontSize: sizes.lg, color: colors.textSecondary, marginTop: 6}}
                numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>
            <View style={[styles.lyrHint, {backgroundColor: colors.accentDim}]}>
              <Icon name="document-text-outline" size={16} color={colors.accent} />
              <Text style={{fontSize: sizes.xs, color: colors.accent}}>
                {t('fullPlayer.lyricsHint')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Lyrics Offset Bar */}
      {showOffsetBar && showLyrics && (
        <View style={[styles.offsetBar, {backgroundColor: colors.bgElevated, borderColor: colors.border}]}>
          <Text style={{fontSize: sizes.sm, color: colors.textSecondary, fontWeight: '600'}}>{t('lyrics.offset.title')}</Text>
          <TouchableOpacity onPress={() => adjustOffset(-OFFSET_STEP)} style={[styles.offsetBtn, {backgroundColor: colors.bgCard}]}>
            <Text style={{fontSize: sizes.md, color: colors.textPrimary, fontWeight: '700'}}>-</Text>
          </TouchableOpacity>
          <Text style={{fontSize: sizes.md, color: colors.accent, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 60, textAlign: 'center'}}>
            {lyricsOffset >= 0 ? '+' : ''}{lyricsOffset.toFixed(1)}s
          </Text>
          <TouchableOpacity onPress={() => adjustOffset(OFFSET_STEP)} style={[styles.offsetBtn, {backgroundColor: colors.bgCard}]}>
            <Text style={{fontSize: sizes.md, color: colors.textPrimary, fontWeight: '700'}}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resetOffset} style={{marginLeft: 8}}>
            <Text style={{fontSize: sizes.sm, color: colors.textMuted}}>{t('lyrics.offset.reset')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowOffsetBar(false)} style={{marginLeft: 'auto', padding: 4}}>
            <Icon name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <ProgressBar position={position} duration={duration} />

        <View style={styles.funcRow}>
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
                {color: colors.textMuted},
                playbackSpeed !== 1.0 && {color: colors.accent},
              ]}>
              {playbackSpeed}x
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowQueue(true)}
            style={styles.funcBtn}
            accessibilityLabel="Play queue"
            accessibilityRole="button">
            <Icon name="list-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowEQ(true)}
            style={styles.funcBtn}
            accessibilityLabel="Equalizer"
            accessibilityRole="button">
            <Icon name="options-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {showSpeed && (
          <View style={styles.speedRow}>
            {SPEEDS.map(s => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.speedBtn,
                  {backgroundColor: colors.bgCard, borderColor: colors.border},
                  playbackSpeed === s && {
                    backgroundColor: colors.accent,
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => changeSpeed(s)}>
                <Text
                  style={[
                    styles.speedBtnTxt,
                    {color: colors.textMuted},
                    playbackSpeed === s && {color: colors.bg},
                  ]}>
                  {s}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.mainCtrl}>
          <TouchableOpacity
            onPress={cycleRepeat}
            style={styles.ctrlSideBtn}
            accessibilityLabel="Repeat mode"
            accessibilityRole="button">
            <Icon
              name={cfg.icon}
              size={22}
              color={repeatMode !== 'off' ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
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
            style={[styles.playBtn, {backgroundColor: colors.accent, shadowColor: colors.accent}]}
            activeOpacity={0.8}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityRole="button">
            <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={colors.bg} />
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
          <TouchableOpacity onPress={() => setShowMore(true)} style={styles.ctrlSideBtn} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
            <Icon name="ellipsis-horizontal" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {showModeToast !== '' && (
        <View
          style={[
            styles.modeToast,
            {backgroundColor: colors.bgElevated, borderColor: colors.border},
          ]}>
          <Icon name={cfg.icon} size={16} color={colors.accent} />
          <Text style={{fontSize: sizes.sm, color: colors.accent, fontWeight: '600'}}>
            {showModeToast}
          </Text>
        </View>
      )}

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
          <View style={{flex: 1, backgroundColor: colors.bg}}>
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
            style={[styles.moreOverlay, {backgroundColor: colors.overlay}]}
            onPress={() => setShowMore(false)}>
            <Pressable
              style={[styles.moreSheet, {backgroundColor: colors.bgElevated}]}
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
                style={[styles.moreItem, {borderBottomColor: colors.border}]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  navigation.navigate('RhythmLight' as never);
                }}>
                <View style={[styles.moreItemIcon, {backgroundColor: colors.accentDim}]}>
                  <Icon name="pulse-outline" size={20} color={colors.accent} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600'}}>
                    {t('fullPlayer.moreMenu.rhythmLight')}
                  </Text>
                  <Text style={{fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2}}>
                    {t('fullPlayer.moreMenu.rhythmLightDesc')}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreItem, {borderBottomColor: colors.border}]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  navigation.navigate('CarMode' as never);
                }}>
                <View style={[styles.moreItemIcon, {backgroundColor: colors.accentDim}]}>
                  <Icon name="car-outline" size={20} color={colors.accent} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600'}}>
                    {t('fullPlayer.moreMenu.carMode')}
                  </Text>
                  <Text style={{fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2}}>
                    {t('fullPlayer.moreMenu.carModeDesc')}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreItem, {borderBottomColor: colors.border}]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  setShowAnalyzer(true);
                }}>
                <View style={[styles.moreItemIcon, {backgroundColor: colors.accentDim}]}>
                  <Icon name="analytics-outline" size={20} color={colors.accent} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600'}}>
                    {t('fullPlayer.moreMenu.audioAnalyzer')}
                  </Text>
                  <Text style={{fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2}}>
                    {t('fullPlayer.moreMenu.audioAnalyzerDesc')}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {COVER_SEARCH_ENABLED && (
              <TouchableOpacity
                style={[styles.moreItem, {borderBottomColor: colors.border}]}
                activeOpacity={0.6}
                onPress={() => {
                  setShowMore(false);
                  handleSearchCover();
                }}>
                <View style={[styles.moreItemIcon, {backgroundColor: colors.accentDim}]}>
                  <Icon name="image-outline" size={20} color={colors.accent} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600'}}>
                    {t('fullPlayer.moreMenu.searchCover')}
                  </Text>
                  <Text style={{fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2}}>
                    {t('fullPlayer.moreMenu.searchCoverDesc')}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.moreItem, {borderBottomColor: colors.border}]}
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
                <View style={[styles.moreItemIcon, {backgroundColor: colors.accentDim}]}>
                  <Icon name="timer-outline" size={20} color={colors.accent} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600'}}>
                    {t('fullPlayer.moreMenu.lyricsOffset')}
                  </Text>
                  <Text style={{fontSize: sizes.xs, color: colors.textSecondary, marginTop: 2}}>
                    {t('fullPlayer.moreMenu.lyricsOffsetDesc')}
                  </Text>
                </View>
                {lyricsOffset !== 0 && (
                  <Text style={{fontSize: sizes.sm, color: colors.accent, fontWeight: '600', marginRight: 8}}>
                    {lyricsOffset >= 0 ? '+' : ''}{lyricsOffset.toFixed(1)}s
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
            style={[styles.moreOverlay, {backgroundColor: colors.overlay}]}
            onPress={handleCloseCoverSearch}>
            <Pressable
              style={[styles.coverSearchSheet, {backgroundColor: colors.bgElevated}]}
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
                {coverSaving ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <TouchableOpacity onPress={handleCloseCoverSearch} hitSlop={12}>
                    <Icon name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {/* 歌手名输入框和搜索按钮 */}
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                <Text style={{fontSize: sizes.sm, color: colors.textMuted, marginRight: 8}}>
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
                    style={{fontSize: sizes.md, color: colors.textPrimary, paddingVertical: 2}}
                    value={coverArtist}
                    onChangeText={setCoverArtist}
                    placeholder={t('coverSearch.artistPlaceholder') || '请输入歌手名'}
                    editable={!coverSearching && !coverSaving}
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
                  disabled={coverSearching || coverSaving || !coverArtist.trim()}>
                  <Text style={{color: '#fff', fontWeight: '600'}}>
                    {t('coverSearch.searchButton')}
                  </Text>
                </TouchableOpacity>
              </View>
              {coverSearching ? (
                <View style={styles.coverSearchCenter}>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={{fontSize: sizes.md, color: colors.textMuted, marginTop: 12}}>
                    {t('coverSearch.searching')}
                  </Text>
                </View>
              ) : coverResults.length === 0 ? (
                <View style={styles.coverSearchCenter}>
                  <Icon name="image-outline" size={48} color={colors.textMuted} />
                  <Text style={{fontSize: sizes.md, color: colors.textMuted, marginTop: 12}}>
                    {t('coverSearch.noResults')}
                  </Text>
                </View>
              ) : (
                <ScrollView style={{flex: 1}} showsVerticalScrollIndicator={false}>
                  <View style={styles.coverGrid}>
                    {coverResults.map(r => {
                      const isSelected = selectedCoverId === r.id;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[
                            styles.coverResultItem,
                            {backgroundColor: colors.bgCard, borderColor: isSelected ? colors.accent : colors.border},
                            isSelected && {borderWidth: 2},
                          ]}
                          activeOpacity={0.7}
                          onPress={() => !coverSaving && setSelectedCoverId(r.id)}
                          disabled={coverSaving}>
                          <Image
                            source={{uri: r.thumbUrl}}
                            style={styles.coverThumb}
                            resizeMode="cover"
                          />
                          {isSelected && (
                            <View style={styles.coverSelectedBadge}>
                              <Icon name="checkmark-circle" size={20} color={colors.accent} />
                            </View>
                          )}
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
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
  },
  hBtn: {padding: 8, width: 44, alignItems: 'center'},
  hCenter: {flex: 1, alignItems: 'center'},
  main: {flex: 1},
  lyricsContainer: {flex: 1},
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
  coverArea: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20},
  coverGlow: {
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  trackInfo: {alignItems: 'center', marginTop: 28, paddingHorizontal: 40},
  lyrHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  controls: {paddingBottom: 34},
  offsetBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, marginHorizontal: 20, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 8},
  offsetBtn: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
  funcRow: {flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8, marginBottom: 4},
  funcBtn: {padding: 8},
  speedLabel: {fontSize: 12, fontWeight: '700'},
  speedRow: {flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8},
  speedBtn: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1},
  speedBtnTxt: {fontSize: 12, fontWeight: '600'},
  mainCtrl: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8},
  ctrlSideBtn: {width: 48, alignItems: 'center', justifyContent: 'center'},
  ctrlBtn: {width: 56, alignItems: 'center', justifyContent: 'center'},
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modeToast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 6,
  },
  moreOverlay: {flex: 1, justifyContent: 'flex-end'},
  moreSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  moreHeader: {flexDirection: 'row', alignItems: 'center', paddingVertical: 16},
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
  coverSearchCenter: {alignItems: 'center', justifyContent: 'center', paddingVertical: 60},
  coverGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 20},
  coverResultItem: {
    width: (Dimensions.get('window').width - 40 - 24) / 3,
    borderRadius: 12,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  coverThumb: {width: '100%', aspectRatio: 1, borderRadius: 8} as any,
  coverSelectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});

export default memo(FullPlayerScreen);
