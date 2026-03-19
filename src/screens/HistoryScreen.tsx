// src/screens/HistoryScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackItem from '../components/TrackItem';
import TrackMenu from '../components/TrackMenu';
import { useAppSelector, useAppDispatch } from '../store';
import { playTrack, toggleFavorite, clearHistory } from '../store/musicSlice';
import { Track } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import AlphabetIndex from '../components/AlphabetIndex';
import { useAlphabetIndex } from '../hooks/useAlphabetIndex';
import LocatePlayingButton, { LocatePlayingRef } from '../components/LocatePlayingButton';

const HistoryScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { tracks, currentTrack, playHistory, repeatMode } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const locateRef = useRef<LocatePlayingRef>(null);

  const historyTracks = useMemo(() => {
    return playHistory
      .map(h => tracks.find(t => t.id === h.trackId))
      .filter((t): t is Track => t != null);
  }, [tracks, playHistory]);

  const {
    sortedTracks: sortedHistoryTracks,
    letters,
    indexVisible,
    onSelectLetter,
    onIndexTouchStart,
    onIndexTouchEnd,
    onScroll: onAlphabetScroll,
  } = useAlphabetIndex(historyTracks, flatListRef);

  const handlePlay = useCallback((t: Track) => {
    dispatch(playTrack({ track: t, queue: sortedHistoryTracks, shuffle: repeatMode === 'queue' }));
  }, [dispatch, sortedHistoryTracks, repeatMode]);

  const handleFav = useCallback((id: string) => { dispatch(toggleFavorite(id)); }, [dispatch]);
  const handleOpenMenu = useCallback((t: Track) => { setMenuTrack(t); setShowMenu(true); }, []);

  const handleClear = () => {
    Alert.alert('清空历史', '确定要清空全部播放历史吗？', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => dispatch(clearHistory()) },
    ]);
  };

  const renderItem = useCallback(({ item }: { item: Track }) => (
    <TrackItem track={item} isActive={currentTrack?.id === item.id} onPress={handlePlay} onToggleFavorite={handleFav} onOpenMenu={handleOpenMenu} />
  ), [currentTrack?.id, handlePlay, handleFav, handleOpenMenu]);

  if (historyTracks.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.bgCard }]}>
          <Icon name="time-outline" size={72} color={colors.textMuted} />
        </View>
        <Text style={{ fontSize: sizes.xl, fontWeight: '600', color: colors.textSecondary }}>暂无播放记录</Text>
        <Text style={{ fontSize: sizes.md, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          播放歌曲后会自动记录在这里
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={{ fontSize: sizes.xxxl, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>播放历史</Text>
        <TouchableOpacity onPress={handleClear} hitSlop={8}>
          <Icon name="trash-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: sizes.sm, color: colors.textMuted, paddingHorizontal: 20, paddingBottom: 8 }}>
        共 {historyTracks.length} 首
      </Text>
      <View style={{flex: 1}}>
        <FlatList ref={flatListRef} data={sortedHistoryTracks} renderItem={renderItem} keyExtractor={(item, idx) => `${item.id}-${idx}`}
          contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={true}
          onScrollBeginDrag={() => { onAlphabetScroll(); locateRef.current?.show(); }}
          initialNumToRender={15} maxToRenderPerBatch={10} />
        <AlphabetIndex
          letters={letters}
          visible={indexVisible}
          onSelectLetter={onSelectLetter}
          onTouchStart={onIndexTouchStart}
          onTouchEnd={onIndexTouchEnd}
        />
        <LocatePlayingButton
          ref={locateRef}
          flatListRef={flatListRef}
          tracks={sortedHistoryTracks}
          currentTrack={currentTrack}
        />
      </View>
      <TrackMenu track={menuTrack} visible={showMenu} onClose={() => { setShowMenu(false); setMenuTrack(null); }} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
});

export default HistoryScreen;
