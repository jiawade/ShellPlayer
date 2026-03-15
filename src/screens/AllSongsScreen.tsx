// src/screens/AllSongsScreen.tsx
// Only change: handlePlay passes shuffle flag based on repeatMode
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, RefreshControl, Modal, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackItem from '../components/TrackItem';
import SearchBar from '../components/SearchBar';
import TrackMenu from '../components/TrackMenu';
import FolderPickerScreen from './FolderPickerScreen';
import { useAppSelector, useAppDispatch } from '../store';
import {
  scanMusic, loadFavorites, loadScanDirs, loadHiddenTracks,
  loadCachedTracks, playTrack, toggleFavorite, setSearchQuery,
} from '../store/musicSlice';
import { Track } from '../types';
import { COLORS, SIZES } from '../utils/theme';

const AllSongsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { tracks, currentTrack, isScanning, scanError, searchQuery, scanDirectories, scanProgress, repeatMode } =
    useAppSelector(s => s.music);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevScanningRef = React.useRef(false);
  const [prevTrackCount, setPrevTrackCount] = useState(0);

  useEffect(() => {
    if (prevScanningRef.current && !isScanning && !loading && prevTrackCount === 0 && tracks.length > 0) {
      Alert.alert('导入完成', `成功导入了 ${tracks.length} 首歌曲`);
    }
    prevScanningRef.current = isScanning;
  }, [isScanning, loading, tracks.length, prevTrackCount]);

  useEffect(() => {
    const init = async () => {
      await dispatch(loadFavorites());
      await dispatch(loadHiddenTracks());
      const cacheResult = await dispatch(loadCachedTracks());
      const cachedCount = ((cacheResult as any).payload || []).length;
      const dirsAction = await dispatch(loadScanDirs());
      const dirs = (dirsAction as any).payload || [];
      setLoading(false);
      setPrevTrackCount(cachedCount);
      if (cachedCount > 0 && dirs.length > 0) {
        prevScanningRef.current = false;
        dispatch(scanMusic(dirs));
        setTimeout(() => { prevScanningRef.current = false; }, 100);
      } else if (dirs.length > 0 && cachedCount === 0) {
        dispatch(scanMusic(dirs));
      } else if (dirs.length === 0 && cachedCount === 0) {
        setShowFolderPicker(true);
      }
    };
    init();
  }, [dispatch]);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.toLowerCase().trim();
    return tracks.filter(t =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.fileName.toLowerCase().includes(q)
    );
  }, [tracks, searchQuery]);

  // 传递 shuffle 标志
  const handlePlay = useCallback((t: Track) => {
    dispatch(playTrack({ track: t, queue: filteredTracks, shuffle: repeatMode === 'queue' }));
  }, [dispatch, filteredTracks, repeatMode]);

  const handleFav = useCallback((id: string) => { dispatch(toggleFavorite(id)); }, [dispatch]);
  const handleOpenMenu = useCallback((t: Track) => { setMenuTrack(t); setShowMenu(true); }, []);
  const handleCloseMenu = useCallback(() => { setShowMenu(false); setMenuTrack(null); }, []);
  const handleRefresh = useCallback(() => { if (scanDirectories.length > 0) dispatch(scanMusic(scanDirectories)); }, [dispatch, scanDirectories]);
  const handleFolderConfirm = useCallback((dirs: string[]) => {
    setShowFolderPicker(false); setPrevTrackCount(0); dispatch(scanMusic(dirs));
  }, [dispatch]);

  const renderItem = useCallback(({ item }: { item: Track }) => (
    <TrackItem track={item} isActive={currentTrack?.id === item.id} onPress={handlePlay} onToggleFavorite={handleFav} onOpenMenu={handleOpenMenu} />
  ), [currentTrack?.id, handlePlay, handleFav, handleOpenMenu]);

  const keyExtractor = useCallback((item: Track) => item.id, []);

  if (loading) return <View style={styles.root} />;

  if (isScanning && tracks.length === 0) {
    const p = scanProgress;
    const pct = p && p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadTxt}>正在导入歌曲</Text>
        <Text style={styles.loadSub}>{p?.phase === 'scanning' ? '正在扫描文件夹...' : '正在解析歌曲元数据...'}</Text>
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>
          <Text style={styles.progressText}>{pct}%</Text>
        </View>
        {p?.phase === 'parsing' && <Text style={styles.progressDetail}>{p.current} / {p.total} 首</Text>}
      </View>
    );
  }

  if (tracks.length === 0 && !isScanning) {
    return (
      <View style={styles.center}>
        {scanError ? (
          <><Icon name="alert-circle-outline" size={64} color={COLORS.secondary} /><Text style={styles.errTxt}>{scanError}</Text></>
        ) : (
          <><Icon name="folder-open-outline" size={64} color={COLORS.textMuted} /><Text style={styles.emptyTxt}>未找到本地音乐</Text><Text style={styles.emptySub}>请选择包含音乐文件的目录</Text></>
        )}
        <TouchableOpacity style={styles.retryBtn} onPress={() => setShowFolderPicker(true)}>
          <Icon name="folder-outline" size={18} color={COLORS.bg} /><Text style={styles.retryTxt}>选择扫描目录</Text>
        </TouchableOpacity>
        <Modal visible={showFolderPicker} animationType="slide">
          <FolderPickerScreen onConfirm={handleFolderConfirm} onCancel={() => setShowFolderPicker(false)} initialSelected={scanDirectories} />
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>全部歌曲</Text>
        <View style={styles.headerRight}>
          {isScanning && <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 12 }} />}
          <TouchableOpacity onPress={() => setShowFolderPicker(true)} hitSlop={8}>
            <Icon name="folder-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      <SearchBar value={searchQuery} onChangeText={(text) => dispatch(setSearchQuery(text))} />
      <Text style={styles.count}>{searchQuery ? `找到 ${filteredTracks.length} 首` : `共 ${tracks.length} 首`}</Text>
      <FlatList
        data={filteredTracks} renderItem={renderItem} keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={true}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
        initialNumToRender={20} maxToRenderPerBatch={15} windowSize={11} removeClippedSubviews={true}
        getItemLayout={(_, i) => ({ length: 66, offset: 66 * i, index: i })}
        ListEmptyComponent={searchQuery ? <View style={styles.noResult}><Icon name="search-outline" size={48} color={COLORS.textMuted} /><Text style={styles.noResultTxt}>没有找到匹配的歌曲</Text></View> : null}
      />
      <Modal visible={showFolderPicker} animationType="slide">
        <FolderPickerScreen onConfirm={handleFolderConfirm} onCancel={() => setShowFolderPicker(false)} initialSelected={scanDirectories} />
      </Modal>
      <TrackMenu track={menuTrack} visible={showMenu} onClose={handleCloseMenu} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: SIZES.xxxl, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  count: { fontSize: SIZES.sm, color: COLORS.textMuted, paddingHorizontal: 20, paddingBottom: 4 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 24, width: '80%', gap: 12 },
  progressBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.bgElevated, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.accent },
  progressText: { fontSize: SIZES.md, color: COLORS.accent, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
  progressDetail: { fontSize: SIZES.sm, color: COLORS.textMuted, marginTop: 8, fontVariant: ['tabular-nums'] },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  loadTxt: { fontSize: SIZES.xl, color: COLORS.textPrimary, fontWeight: '600', marginTop: 20 },
  loadSub: { fontSize: SIZES.md, color: COLORS.textMuted, marginTop: 8 },
  errTxt: { fontSize: SIZES.lg, color: COLORS.secondary, marginTop: 16, textAlign: 'center' },
  emptyTxt: { fontSize: SIZES.xl, color: COLORS.textSecondary, marginTop: 16, fontWeight: '600' },
  emptySub: { fontSize: SIZES.md, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: COLORS.accent, gap: 8 },
  retryTxt: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.bg },
  noResult: { alignItems: 'center', marginTop: 60 },
  noResultTxt: { fontSize: SIZES.md, color: COLORS.textMuted, marginTop: 12 },
});

export default AllSongsScreen;
