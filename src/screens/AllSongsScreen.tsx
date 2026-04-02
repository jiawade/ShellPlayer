// src/screens/AllSongsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  Platform,
  InteractionManager,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import TrackItem from '../components/TrackItem';
import SearchBar from '../components/SearchBar';
import TrackMenu from '../components/TrackMenu';
import FolderPickerScreen from './FolderPickerScreen';
import SwipeBackWrapper from '../components/SwipeBackWrapper';
import { useAppSelector, useAppDispatch, store } from '../store';
import {
  scanMusic,
  loadFavorites,
  loadScanDirs,
  loadHiddenTracks,
  loadCachedTracks,
  repairCachedArtwork,
  loadLastPlayback,
  setCurrentTrack,
  setCurrentIndex,
  playTrack,
  toggleFavorite,
  setSearchQuery,
  setSortMode,
  toggleBatchMode,
  toggleBatchSelect,
  batchFavorite,
  batchHide,
  selectAllBatch,
  clearBatchSelect,
  importiOSMediaLibrary,
  IOSImportOptions,
} from '../store/musicSlice';
import TrackPlayer from 'react-native-track-player';
import { exportTrackToFile } from '../utils/mediaLibrary';
import { Track, SortMode } from '../types';
import { deduplicateTracks } from '../utils/dedup';
import { useTheme } from '../contexts/ThemeContext';
import AlphabetIndex from '../components/AlphabetIndex';
import { useAlphabetIndex } from '../hooks/useAlphabetIndex';
import LocatePlayingButton, { LocatePlayingRef } from '../components/LocatePlayingButton';
import { useTranslation } from 'react-i18next';
import AlbumsScreen from './AlbumsScreen';
import AlbumDetailScreen from './AlbumDetailScreen';
import ArtistsScreen from './ArtistsScreen';
import ArtistDetailScreen from './ArtistDetailScreen';

type LibrarySegment = 'songs' | 'albums' | 'artists';

const SORT_OPTIONS_KEYS: { mode: SortMode; labelKey: string; icon: string }[] = [
  { mode: 'title', labelKey: 'allSongs.sort.byName', icon: 'text-outline' },
  { mode: 'artist', labelKey: 'allSongs.sort.byArtist', icon: 'person-outline' },
  { mode: 'album', labelKey: 'allSongs.sort.byAlbum', icon: 'disc-outline' },
  { mode: 'duration', labelKey: 'allSongs.sort.byDuration', icon: 'timer-outline' },
  { mode: 'recent', labelKey: 'allSongs.sort.recent', icon: 'time-outline' },
  { mode: 'shuffle', labelKey: 'allSongs.sort.shuffle', icon: 'shuffle-outline' },
];

const hashToUnit = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const AllSongsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const {
    tracks,
    currentTrack,
    isScanning,
    scanError,
    searchQuery,
    scanDirectories,
    scanProgress,
    repeatMode,
    sortMode,
    hideDuplicates,
    batchSelectMode,
    batchSelectedIds,
  } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList>(null);
  const locateRef = useRef<LocatePlayingRef>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const savedTrackIdRef = useRef<string | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(() => Date.now());
  const [userTriggeredImport, setUserTriggeredImport] = useState(false);
  const [activeSegment, setActiveSegment] = useState<LibrarySegment>('songs');
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const prevScanningRef = React.useRef(false);
  const [prevTrackCount, setPrevTrackCount] = useState(0);

  useEffect(() => {
    if (prevScanningRef.current && !isScanning && !loading) {
      setUserTriggeredImport(false);
      const newCount = tracks.length - prevTrackCount;
      if (prevTrackCount === 0 && tracks.length > 0) {
        Alert.alert(
          t('allSongs.importAlerts.importComplete'),
          t('allSongs.importAlerts.successMessage', { count: tracks.length }),
        );
      } else if (newCount > 0) {
        Alert.alert(
          t('allSongs.importAlerts.importComplete'),
          t('allSongs.importAlerts.newSongsMessage', { newCount, totalCount: tracks.length }),
        );
      } else if (userTriggeredImport && tracks.length > 0) {
        Alert.alert(
          t('allSongs.importAlerts.importComplete'),
          t('allSongs.importAlerts.noNewSongsMessage', { totalCount: tracks.length }),
        );
      }
      // Reset baseline after each completed import/scan so next session's delta is accurate.
      setPrevTrackCount(tracks.length);
    }
    prevScanningRef.current = isScanning;
  }, [isScanning, loading, tracks.length, prevTrackCount, userTriggeredImport]);

  useEffect(() => {
    const init = async () => {
      // 并行加载所有缓存数据，加速启动
      const [, , cacheResult, lastPlaybackRaw] = await Promise.all([
        dispatch(loadFavorites()),
        dispatch(loadHiddenTracks()),
        dispatch(loadCachedTracks()),
        AsyncStorage.getItem('@lastPlayback'),
      ]);
      // 保存上次播放 trackId，用于 FlatList initialScrollIndex
      try {
        if (lastPlaybackRaw) {
          const parsed = JSON.parse(lastPlaybackRaw);
          if (parsed?.trackId) savedTrackIdRef.current = parsed.trackId;
        }
      } catch {}
      const cachedCount = ((cacheResult as any).payload || []).length;
      // 二次校验：Redux state 中的 tracks（reducer 已在 dispatch 返回前写入）
      const storeTrackCount = store.getState().music.tracks.length;
      const hasTracks = cachedCount > 0 || storeTrackCount > 0;

      // 后台修复封面（延迟执行，不阻塞 UI 交互）
      if (hasTracks) {
        InteractionManager.runAfterInteractions(() => {
          dispatch(repairCachedArtwork());
        });
      }

      if (Platform.OS === 'ios') {
        setLoading(false);
        setPrevTrackCount(cachedCount);
        if (!hasTracks) {
          setShowFolderPicker(true);
        }
      } else {
        // Android: 从扫描目录导入
        const dirsAction = await dispatch(loadScanDirs());
        const dirs = (dirsAction as any).payload || [];
        setLoading(false);
        setPrevTrackCount(cachedCount);
        if (!hasTracks) {
          if (dirs.length > 0) {
            dispatch(scanMusic(dirs));
          } else {
            setShowFolderPicker(true);
          }
        }
      }
    };
    init();
  }, [dispatch]);

  // 恢复上次播放的歌曲和进度（不自动播放）
  const restoredRef = useRef(false);
  useEffect(() => {
    if (loading || tracks.length === 0 || restoredRef.current || currentTrack) {
      return;
    }
    restoredRef.current = true;

    const restore = async () => {
      const result = await dispatch(loadLastPlayback());
      const payload = (result as any).payload as { trackId: string; position: number } | null;
      if (!payload?.trackId) {
        return;
      }

      const track = tracks.find(t => t.id === payload.trackId);
      if (!track) {
        return;
      }

      // 设置 Redux 状态（显示 MiniPlayer、进度条等）
      dispatch(setCurrentTrack(track));
      dispatch(setCurrentIndex(tracks.findIndex(t => t.id === payload.trackId)));

      // 将歌曲加入 TrackPlayer 并 seek 到上次位置，但不播放
      try {
        const url = track.url.startsWith('ipod-library://')
          ? await exportTrackToFile(track.url)
          : track.url;
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: track.id,
          url,
          title: track.title,
          artist: track.artist,
          artwork: track.artwork,
        });
        if (payload.position > 0) {
          await TrackPlayer.seekTo(payload.position);
        }
      } catch {}
    };
    restore();
  }, [loading, tracks, currentTrack, dispatch]);

  const {
    sortedTracks: pinyinSorted,
    letters,
    onSelectLetter,
    onIndexTouchStart,
    onIndexTouchEnd,
    onScroll: onAlphabetScroll,
  } = useAlphabetIndex(tracks, flatListRef);

  const filteredTracks = useMemo(() => {
    let list = sortMode === 'title' ? [...pinyinSorted] : [...tracks];
    if (hideDuplicates) {
      list = deduplicateTracks(list);
    }
    if (sortMode === 'artist') {
      list.sort((a, b) => a.artist.localeCompare(b.artist, 'zh-CN'));
    } else if (sortMode === 'album') {
      list.sort((a, b) => a.album.localeCompare(b.album, 'zh-CN'));
    } else if (sortMode === 'duration') {
      list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else if (sortMode === 'recent') {
      list.reverse();
    } else if (sortMode === 'shuffle') {
      list.sort(
        (a, b) => hashToUnit(`${shuffleSeed}:${a.id}`) - hashToUnit(`${shuffleSeed}:${b.id}`),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.fileName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tracks, pinyinSorted, searchQuery, sortMode, hideDuplicates, shuffleSeed]);

  const handleSortChange = useCallback(
    (mode: SortMode) => {
      if (mode === 'shuffle') {
        setShuffleSeed(Date.now());
      }
      dispatch(setSortMode(mode));
      setShowSort(false);
    },
    [dispatch],
  );

  const filteredTracksRef = useRef(filteredTracks);
  filteredTracksRef.current = filteredTracks;

  // 计算首次渲染的滚动位置，避免列表闪烁
  const initialScrollIndex = useMemo(() => {
    if (!savedTrackIdRef.current) return undefined;
    const idx = filteredTracks.findIndex(t => t.id === savedTrackIdRef.current);
    if (idx < 0) return undefined;
    return Math.max(0, idx - 2);
  }, [filteredTracks]);

  const handlePlay = useCallback(
    (t: Track) => {
      if (batchSelectMode) {
        dispatch(toggleBatchSelect(t.id));
        return;
      }
      dispatch(
        playTrack({
          track: t,
          queue: filteredTracksRef.current,
          shuffle: repeatMode === 'queue',
        }),
      );
    },
    [dispatch, repeatMode, batchSelectMode],
  );

  const handleFav = useCallback(
    (id: string) => {
      dispatch(toggleFavorite(id));
    },
    [dispatch],
  );
  const handleOpenMenu = useCallback(
    (t: Track) => {
      if (batchSelectMode) {
        return;
      }
      setMenuTrack(t);
      setShowMenu(true);
    },
    [batchSelectMode],
  );
  const handleCloseMenu = useCallback(() => {
    setShowMenu(false);
    setMenuTrack(null);
  }, []);
  const handleFolderConfirm = useCallback(
    (dirs: string[]) => {
      setShowFolderPicker(false);
      setPrevTrackCount(0);
      setUserTriggeredImport(true);
      dispatch(scanMusic(dirs));
    },
    [dispatch],
  );
  const handleIOSImport = useCallback(
    (opts: IOSImportOptions) => {
      setShowFolderPicker(false);
      setPrevTrackCount(tracks.length);
      setUserTriggeredImport(true);
      dispatch(importiOSMediaLibrary(opts));
    },
    [dispatch, tracks.length],
  );

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <TrackItem
        track={item}
        isActive={currentTrack?.id === item.id}
        onPress={handlePlay}
        onToggleFavorite={handleFav}
        onOpenMenu={handleOpenMenu}
        batchMode={batchSelectMode}
        batchSelected={batchSelectedIds.includes(item.id)}
      />
    ),
    [currentTrack?.id, handlePlay, handleFav, handleOpenMenu, batchSelectMode, batchSelectedIds],
  );

  const keyExtractor = useCallback((item: Track) => item.id, []);

  if (loading) {
    return <View style={[styles.root, { backgroundColor: colors.bg }]} />;
  }

  if (isScanning && (tracks.length === 0 || userTriggeredImport)) {
    const p = scanProgress;
    const pct = p && p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text
          style={{
            fontSize: sizes.xl,
            color: colors.textPrimary,
            fontWeight: '600',
            marginTop: 20,
          }}>
          {t('allSongs.importing.title')}
        </Text>
        <Text style={{ fontSize: sizes.md, color: colors.textMuted, marginTop: 8 }}>
          {p?.phase === 'scanning'
            ? Platform.OS === 'ios'
              ? t('allSongs.importing.readingLibrary')
              : t('allSongs.importing.scanning')
            : t('allSongs.importing.parsing')}
        </Text>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBg, { backgroundColor: colors.bgElevated }]}>
            <View
              style={[styles.progressFill, { backgroundColor: colors.accent, width: `${pct}%` }]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.accent }]}>{pct}%</Text>
        </View>
        {p?.phase === 'parsing' && (
          <Text
            style={{
              color: colors.textMuted,
              marginTop: 8,
              fontVariant: ['tabular-nums'],
            }}>
            {p.current} / {p.total} {t('common.song')}
          </Text>
        )}
      </View>
    );
  }

  if (tracks.length === 0 && !isScanning) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Icon
          name={Platform.OS === 'ios' ? 'musical-notes-outline' : 'folder-open-outline'}
          size={64}
          color={colors.textMuted}
        />
        <Text
          style={{
            fontSize: sizes.xl,
            color: colors.textSecondary,
            marginTop: 16,
            fontWeight: '600',
          }}>
          {t('allSongs.emptyState.noMusic')}
        </Text>
        {scanError ? (
          <Text
            style={{
              fontSize: sizes.sm,
              color: colors.textMuted,
              marginTop: 12,
              paddingHorizontal: 32,
              textAlign: 'center',
            }}>
            {scanError}
          </Text>
        ) : null}
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate('ImportSongs')}>
          <Icon name="add-circle-outline" size={18} color={colors.bg} />
          <Text style={{ fontSize: sizes.md, fontWeight: '700', color: colors.bg }}>
            {t('allSongs.emptyState.importSongs')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text
          style={{
            fontSize: sizes.xxxl,
            fontWeight: '800',
            color: colors.textPrimary,
            letterSpacing: -0.5,
          }}>
          {t('allSongs.title')}
        </Text>
        <View style={styles.headerRight}>
          {isScanning && (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
          )}
          <TouchableOpacity
            onPress={() => dispatch(toggleBatchMode())}
            hitSlop={8}
            style={{ marginRight: 10 }}>
            <Icon
              name={batchSelectMode ? 'close-circle' : 'checkbox-outline'}
              size={22}
              color={batchSelectMode ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSort(!showSort)}
            hitSlop={8}
            >
            <Icon name="swap-vertical-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.segmentRow}>
        {(['songs', 'albums', 'artists'] as LibrarySegment[]).map(seg => (
          <TouchableOpacity
            key={seg}
            style={[
              styles.segmentBtn,
              { backgroundColor: activeSegment === seg ? colors.accent : 'transparent' },
            ]}
            onPress={() => {
              setActiveSegment(seg);
              setSelectedAlbum(null);
              setSelectedArtist(null);
            }}>
            <Text
              style={[
                styles.segmentTxt,
                { color: activeSegment === seg ? colors.bg : colors.textMuted },
              ]}>
              {t(`library.segments.${seg}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeSegment === 'albums' ? (
        selectedAlbum ? (
          <AlbumDetailScreen albumName={selectedAlbum} onBack={() => setSelectedAlbum(null)} />
        ) : (
          <AlbumsScreen onSelectAlbum={setSelectedAlbum} />
        )
      ) : activeSegment === 'artists' ? (
        selectedArtist && selectedAlbum ? (
          <AlbumDetailScreen albumName={selectedAlbum} onBack={() => setSelectedAlbum(null)} />
        ) : selectedArtist ? (
          <ArtistDetailScreen
            artistName={selectedArtist}
            onBack={() => setSelectedArtist(null)}
            onSelectAlbum={setSelectedAlbum}
          />
        ) : (
          <ArtistsScreen onSelectArtist={setSelectedArtist} />
        )
      ) : (
        <>
          {showSort && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.sortScrollView}
              contentContainerStyle={styles.sortRow}>
              {SORT_OPTIONS_KEYS.map(o => (
                <TouchableOpacity
                  key={o.mode}
                  style={[
                    styles.sortBtn,
                    { backgroundColor: colors.bgCard },
                    sortMode === o.mode && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => handleSortChange(o.mode)}>
                  <Icon
                    name={o.icon}
                    size={14}
                    color={sortMode === o.mode ? colors.bg : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.sortTxt,
                      { color: colors.textMuted },
                      sortMode === o.mode && { color: colors.bg },
                    ]}>
                    {t(o.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {batchSelectMode && (
            <View
              style={[
                styles.batchBar,
                {
                  backgroundColor: colors.bgElevated,
                  borderBottomColor: colors.border,
                },
              ]}>
              <TouchableOpacity onPress={() => dispatch(selectAllBatch())}>
                <Text
                  style={{
                    fontSize: sizes.sm,
                    color: colors.accent,
                    fontWeight: '600',
                  }}>
                  {t('allSongs.batch.selectAll')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => dispatch(clearBatchSelect())}>
                <Text
                  style={{
                    fontSize: sizes.sm,
                    color: colors.accent,
                    fontWeight: '600',
                  }}>
                  {t('allSongs.batch.cancel')}
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  flex: 1,
                  fontSize: sizes.sm,
                  color: colors.textMuted,
                  textAlign: 'center',
                }}>
                {t('allSongs.batch.selectedCount', { count: batchSelectedIds.length })}
              </Text>
              <TouchableOpacity
                onPress={() => dispatch(batchFavorite())}
                style={[styles.batchBtn, { backgroundColor: colors.bgCard }]}>
                <Icon name="heart" size={16} color={colors.heart} />
                <Text
                  style={{
                    fontSize: sizes.xs,
                    color: colors.heart,
                    fontWeight: '600',
                  }}>
                  {t('allSongs.batch.favorite')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    t('allSongs.batch.deleteTitle'),
                    t('allSongs.batch.deleteMessage', { count: batchSelectedIds.length }),
                    [
                      { text: t('common.cancel') },
                      { text: t('common.confirm'), onPress: () => dispatch(batchHide()) },
                    ],
                  );
                }}
                style={[styles.batchBtn, { backgroundColor: colors.bgCard }]}>
                <Icon name="trash-outline" size={16} color={colors.secondary} />
                <Text
                  style={{
                    fontSize: sizes.xs,
                    color: colors.secondary,
                    fontWeight: '600',
                  }}>
                  {t('allSongs.batch.hide')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <SearchBar value={searchQuery} onChangeText={t => dispatch(setSearchQuery(t))} />
          <Text
            style={{
              fontSize: sizes.sm,
              color: colors.textMuted,
              paddingHorizontal: 20,
              paddingBottom: 4,
            }}>
            {searchQuery
              ? t('allSongs.songCount.found', { count: filteredTracks.length })
              : hideDuplicates
              ? t('allSongs.songCount.totalDedup', { count: filteredTracks.length })
              : t('allSongs.songCount.total', { count: tracks.length })}
          </Text>

          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={filteredTracks}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={{ paddingBottom: 140 }}
              showsVerticalScrollIndicator={true}
              onScrollBeginDrag={() => {
                if (sortMode === 'title' && !searchQuery) onAlphabetScroll();
                locateRef.current?.show();
              }}
              initialScrollIndex={initialScrollIndex}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={11}
              removeClippedSubviews={false}
              getItemLayout={(_, i) => ({ length: 76, offset: 76 * i, index: i })}
              ListEmptyComponent={
                searchQuery ? (
                  <View style={styles.noResult}>
                    <Icon name="search-outline" size={48} color={colors.textMuted} />
                    <Text
                      style={{
                        fontSize: sizes.md,
                        color: colors.textMuted,
                        marginTop: 12,
                      }}>
                      {t('allSongs.noMatch')}
                    </Text>
                  </View>
                ) : null
              }
            />
            {sortMode === 'title' && !searchQuery && letters.length > 0 && (
              <AlphabetIndex
                letters={letters}
                visible={true}
                onSelectLetter={onSelectLetter}
                onTouchStart={onIndexTouchStart}
                onTouchEnd={onIndexTouchEnd}
              />
            )}
            <LocatePlayingButton
              ref={locateRef}
              flatListRef={flatListRef}
              tracks={filteredTracks}
              currentTrack={currentTrack}
              itemHeight={76}
            />
          </View>

          <Modal visible={showFolderPicker} animationType="slide">
            <SwipeBackWrapper onSwipeBack={() => setShowFolderPicker(false)}>
              <FolderPickerScreen
                onConfirm={handleFolderConfirm}
                onCancel={() => setShowFolderPicker(false)}
                initialSelected={Platform.OS === 'ios' ? [] : scanDirectories}
                onIOSImport={Platform.OS === 'ios' ? handleIOSImport : undefined}
              />
            </SwipeBackWrapper>
          </Modal>
          <TrackMenu track={menuTrack} visible={showMenu} onClose={handleCloseMenu} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 4,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  sortScrollView: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 4,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingRight: 30,
    gap: 8,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sortTxt: { fontSize: 10, fontWeight: '600' },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    width: '80%',
    gap: 12,
  },
  progressBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  noResult: { alignItems: 'center', marginTop: 60 },
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 8,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  segmentTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default AllSongsScreen;
