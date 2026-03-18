// src/screens/AllSongsScreen.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackItem from '../components/TrackItem';
import SearchBar from '../components/SearchBar';
import TrackMenu from '../components/TrackMenu';
import FolderPickerScreen from './FolderPickerScreen';
import {useAppSelector, useAppDispatch} from '../store';
import {
  scanMusic,
  loadFavorites,
  loadScanDirs,
  loadHiddenTracks,
  loadCachedTracks,
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
import {Track, SortMode} from '../types';
import {useTheme} from '../contexts/ThemeContext';

const SORT_OPTIONS: {mode: SortMode; label: string; icon: string}[] = [
  {mode: 'title', label: '按名称', icon: 'text-outline'},
  {mode: 'artist', label: '按歌手', icon: 'person-outline'},
  {mode: 'recent', label: '最近添加', icon: 'time-outline'},
];

const AllSongsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
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
    batchSelectMode,
    batchSelectedIds,
  } = useAppSelector(s => s.music);
  const {colors, sizes} = useTheme();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userTriggeredImport, setUserTriggeredImport] = useState(false);
  const prevScanningRef = React.useRef(false);
  const [prevTrackCount, setPrevTrackCount] = useState(0);

  useEffect(() => {
    if (prevScanningRef.current && !isScanning && !loading) {
      setUserTriggeredImport(false);
      const newCount = tracks.length - prevTrackCount;
      if (prevTrackCount === 0 && tracks.length > 0) {
        Alert.alert('导入完成', `成功导入了 ${tracks.length} 首歌曲`);
      } else if (newCount > 0) {
        Alert.alert('导入完成', `新增了 ${newCount} 首歌曲，共 ${tracks.length} 首`);
      } else if (userTriggeredImport && tracks.length > 0) {
        Alert.alert('导入完成', `共 ${tracks.length} 首歌曲，没有新增`);
      }
    }
    prevScanningRef.current = isScanning;
  }, [isScanning, loading, tracks.length, prevTrackCount, userTriggeredImport]);

  useEffect(() => {
    const init = async () => {
      // 并行加载所有缓存数据，加速启动
      const [, , cacheResult] = await Promise.all([
        dispatch(loadFavorites()),
        dispatch(loadHiddenTracks()),
        dispatch(loadCachedTracks()),
      ]);
      const cachedCount = ((cacheResult as any).payload || []).length;

      if (Platform.OS === 'ios') {
        setLoading(false);
        setPrevTrackCount(cachedCount);
        if (cachedCount === 0) {
          setShowFolderPicker(true);
        } else {
          prevScanningRef.current = false;
          dispatch(importiOSMediaLibrary(undefined));
          setTimeout(() => {
            prevScanningRef.current = false;
          }, 100);
        }
      } else {
        // Android: 从扫描目录导入
        const dirsAction = await dispatch(loadScanDirs());
        const dirs = (dirsAction as any).payload || [];
        setLoading(false);
        setPrevTrackCount(cachedCount);
        if (cachedCount > 0 && dirs.length > 0) {
          prevScanningRef.current = false;
          dispatch(scanMusic(dirs));
          setTimeout(() => {
            prevScanningRef.current = false;
          }, 100);
        } else if (dirs.length > 0 && cachedCount === 0) {
          dispatch(scanMusic(dirs));
        } else if (dirs.length === 0 && cachedCount === 0) {
          setShowFolderPicker(true);
        }
      }
    };
    init();
  }, [dispatch]);

  const filteredTracks = useMemo(() => {
    let list = [...tracks];
    if (sortMode === 'artist') {
      list.sort((a, b) => a.artist.localeCompare(b.artist, 'zh-CN'));
    } else if (sortMode === 'recent') {
      list.reverse();
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
  }, [tracks, searchQuery, sortMode]);

  const handlePlay = useCallback(
    (t: Track) => {
      if (batchSelectMode) {
        dispatch(toggleBatchSelect(t.id));
        return;
      }
      dispatch(
        playTrack({
          track: t,
          queue: filteredTracks,
          shuffle: repeatMode === 'queue',
        }),
      );
    },
    [dispatch, filteredTracks, repeatMode, batchSelectMode],
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
  const handleRefresh = useCallback(() => {
    setUserTriggeredImport(true);
    setPrevTrackCount(tracks.length);
    if (Platform.OS === 'ios') {
      dispatch(importiOSMediaLibrary(undefined));
    } else if (scanDirectories.length > 0) {
      dispatch(scanMusic(scanDirectories));
    }
  }, [dispatch, scanDirectories, tracks.length]);
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
    ({item}: {item: Track}) => (
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
    [
      currentTrack?.id,
      handlePlay,
      handleFav,
      handleOpenMenu,
      batchSelectMode,
      batchSelectedIds,
    ],
  );

  const keyExtractor = useCallback((item: Track) => item.id, []);

  if (loading) {
    return <View style={[styles.root, {backgroundColor: colors.bg}]} />;
  }

  if (isScanning && (tracks.length === 0 || userTriggeredImport)) {
    const p = scanProgress;
    const pct = p && p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    return (
      <View style={[styles.center, {backgroundColor: colors.bg}]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text
          style={{
            fontSize: sizes.xl,
            color: colors.textPrimary,
            fontWeight: '600',
            marginTop: 20,
          }}>
          正在导入歌曲
        </Text>
        <Text
          style={{fontSize: sizes.md, color: colors.textMuted, marginTop: 8}}>
          {p?.phase === 'scanning'
            ? Platform.OS === 'ios'
              ? '正在读取音乐库和本地文件...'
              : '正在扫描文件夹...'
            : '正在解析歌曲元数据...'}
        </Text>
        <View style={styles.progressWrap}>
          <View
            style={[styles.progressBg, {backgroundColor: colors.bgElevated}]}>
            <View
              style={[
                styles.progressFill,
                {backgroundColor: colors.accent, width: `${pct}%`},
              ]}
            />
          </View>
          <Text style={[styles.progressText, {color: colors.accent}]}>
            {pct}%
          </Text>
        </View>
        {p?.phase === 'parsing' && (
          <Text
            style={{
              fontSize: sizes.sm,
              color: colors.textMuted,
              marginTop: 8,
              fontVariant: ['tabular-nums'],
            }}>
            {p.current} / {p.total} 首
          </Text>
        )}
      </View>
    );
  }

  if (tracks.length === 0 && !isScanning) {
    return (
      <View style={[styles.center, {backgroundColor: colors.bg}]}>
        <Icon
          name={
            Platform.OS === 'ios'
              ? 'musical-notes-outline'
              : 'folder-open-outline'
          }
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
          未找到音乐
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
          style={[styles.retryBtn, {backgroundColor: colors.accent}]}
          onPress={() => setShowFolderPicker(true)}>
          <Icon name={Platform.OS === 'ios' ? 'musical-notes' : 'folder-open-outline'} size={18} color={colors.bg} />
          <Text
            style={{fontSize: sizes.md, fontWeight: '700', color: colors.bg}}>
            {Platform.OS === 'ios' ? '选择导入来源' : '选择扫描目录'}
          </Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <Text
            style={{
              fontSize: sizes.xs,
              color: colors.textMuted,
              marginTop: 16,
              textAlign: 'center',
              paddingHorizontal: 32,
            }}>
            可导入 iTunes/iPod 音乐库，或将音乐文件放入 Documents/music 目录后导入。
          </Text>
        )}
        <Modal visible={showFolderPicker} animationType="slide">
          <FolderPickerScreen
            onConfirm={handleFolderConfirm}
            onCancel={() => setShowFolderPicker(false)}
            initialSelected={Platform.OS === 'ios' ? [] : scanDirectories}
            onIOSImport={Platform.OS === 'ios' ? handleIOSImport : undefined}
          />
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <View style={styles.header}>
        <Text
          style={{
            fontSize: sizes.xxxl,
            fontWeight: '800',
            color: colors.textPrimary,
            letterSpacing: -0.5,
          }}>
          全部歌曲
        </Text>
        <View style={styles.headerRight}>
          {isScanning && (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={{marginRight: 8}}
            />
          )}
          <TouchableOpacity
            onPress={() => dispatch(toggleBatchMode())}
            hitSlop={8}
            style={{marginRight: 10}}>
            <Icon
              name={batchSelectMode ? 'close-circle' : 'checkbox-outline'}
              size={22}
              color={batchSelectMode ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSort(!showSort)}
            hitSlop={8}
            style={{marginRight: 10}}>
            <Icon
              name="swap-vertical-outline"
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowFolderPicker(true)}
            hitSlop={8}>
            <Icon
              name="folder-outline"
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {showSort && (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.mode}
              style={[
                styles.sortBtn,
                {backgroundColor: colors.bgCard},
                sortMode === o.mode && {backgroundColor: colors.accent},
              ]}
              onPress={() => {
                dispatch(setSortMode(o.mode));
                setShowSort(false);
              }}>
              <Icon
                name={o.icon}
                size={14}
                color={sortMode === o.mode ? colors.bg : colors.textMuted}
              />
              <Text
                style={[
                  styles.sortTxt,
                  {color: colors.textMuted},
                  sortMode === o.mode && {color: colors.bg},
                ]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
              全选
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => dispatch(clearBatchSelect())}>
            <Text
              style={{
                fontSize: sizes.sm,
                color: colors.accent,
                fontWeight: '600',
              }}>
              取消
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              fontSize: sizes.sm,
              color: colors.textMuted,
              textAlign: 'center',
            }}>
            已选 {batchSelectedIds.length}
          </Text>
          <TouchableOpacity
            onPress={() => dispatch(batchFavorite())}
            style={[styles.batchBtn, {backgroundColor: colors.bgCard}]}>
            <Icon name="heart" size={16} color={colors.heart} />
            <Text
              style={{
                fontSize: sizes.xs,
                color: colors.heart,
                fontWeight: '600',
              }}>
              收藏
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                '批量删除',
                `确定从列表移除 ${batchSelectedIds.length} 首歌曲？`,
                [
                  {text: '取消'},
                  {text: '确定', onPress: () => dispatch(batchHide())},
                ],
              );
            }}
            style={[styles.batchBtn, {backgroundColor: colors.bgCard}]}>
            <Icon name="trash-outline" size={16} color={colors.secondary} />
            <Text
              style={{
                fontSize: sizes.xs,
                color: colors.secondary,
                fontWeight: '600',
              }}>
              移除
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <SearchBar
        value={searchQuery}
        onChangeText={t => dispatch(setSearchQuery(t))}
      />
      <Text
        style={{
          fontSize: sizes.sm,
          color: colors.textMuted,
          paddingHorizontal: 20,
          paddingBottom: 4,
        }}>
        {searchQuery
          ? `找到 ${filteredTracks.length} 首`
          : `共 ${tracks.length} 首`}
      </Text>

      <FlatList
        data={filteredTracks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{paddingBottom: 140}}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={11}
        removeClippedSubviews={true}
        getItemLayout={(_, i) => ({length: 76, offset: 76 * i, index: i})}
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
                没有找到匹配的歌曲
              </Text>
            </View>
          ) : null
        }
      />

      <Modal visible={showFolderPicker} animationType="slide">
        <FolderPickerScreen
          onConfirm={handleFolderConfirm}
          onCancel={() => setShowFolderPicker(false)}
          initialSelected={Platform.OS === 'ios' ? [] : scanDirectories}
          onIOSImport={Platform.OS === 'ios' ? handleIOSImport : undefined}
        />
      </Modal>
      <TrackMenu
        track={menuTrack}
        visible={showMenu}
        onClose={handleCloseMenu}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 4,
  },
  headerRight: {flexDirection: 'row', alignItems: 'center'},
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 4,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sortTxt: {fontSize: 10, fontWeight: '600'},
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
  progressBg: {flex: 1, height: 6, borderRadius: 3, overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: 3},
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
  noResult: {alignItems: 'center', marginTop: 60},
});

export default AllSongsScreen;
