// src/screens/FavoritesScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackItem from '../components/TrackItem';
import TrackMenu from '../components/TrackMenu';
import { useAppSelector, useAppDispatch } from '../store';
import { playTrack, toggleFavorite } from '../store/musicSlice';
import { Track } from '../types';
import { deduplicateTracks } from '../utils/dedup';
import { useTheme } from '../contexts/ThemeContext';
import AlphabetIndex from '../components/AlphabetIndex';
import { useAlphabetIndex } from '../hooks/useAlphabetIndex';
import LocatePlayingButton, { LocatePlayingRef } from '../components/LocatePlayingButton';

const FavoritesScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { tracks, currentTrack, favoriteIds, repeatMode, hideDuplicates } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const locateRef = useRef<LocatePlayingRef>(null);

  const favTracks = useMemo(() => {
    const fav = tracks.filter(t => favoriteIds.includes(t.id));
    return hideDuplicates ? deduplicateTracks(fav) : fav;
  }, [tracks, favoriteIds, hideDuplicates]);

  const {
    sortedTracks: sortedFavTracks,
    letters,
    indexVisible,
    onSelectLetter,
    onIndexTouchStart,
    onIndexTouchEnd,
    onScroll: onAlphabetScroll,
  } = useAlphabetIndex(favTracks, flatListRef);

  const handlePlay = useCallback((t: Track) => {
    dispatch(playTrack({ track: t, queue: sortedFavTracks, shuffle: repeatMode === 'queue' }));
  }, [dispatch, sortedFavTracks, repeatMode]);

  const handleFav = useCallback((id: string) => { dispatch(toggleFavorite(id)); }, [dispatch]);
  const handleOpenMenu = useCallback((t: Track) => { setMenuTrack(t); setShowMenu(true); }, []);

  const renderItem = useCallback(({ item }: { item: Track }) => (
    <TrackItem track={item} isActive={currentTrack?.id === item.id} onPress={handlePlay} onToggleFavorite={handleFav} onOpenMenu={handleOpenMenu} />
  ), [currentTrack?.id, handlePlay, handleFav, handleOpenMenu]);

  if (favTracks.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.bgCard }]}><Icon name="heart-outline" size={72} color={colors.heartDim} /></View>
        <Text style={{ fontSize: sizes.xl, fontWeight: '600', color: colors.textSecondary }}>还没有喜欢的歌曲</Text>
        <Text style={{ fontSize: sizes.md, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>点击歌曲旁的 ♡ 按钮{'\n'}将歌曲加入收藏</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={{ fontSize: sizes.xxxl, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 }}>我喜欢的</Text>
        <View style={[styles.badge, { backgroundColor: colors.heartDim }]}><Icon name="heart" size={14} color={colors.heart} /><Text style={{ fontSize: sizes.sm, color: colors.heart, fontWeight: '600' }}>{favTracks.length}</Text></View>
      </View>
      <View style={{flex: 1}}>
        <FlatList ref={flatListRef} data={sortedFavTracks} renderItem={renderItem} keyExtractor={item => item.id}
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
          tracks={sortedFavTracks}
          currentTrack={currentTrack}
        />
      </View>
      <TrackMenu track={menuTrack} visible={showMenu} onClose={() => { setShowMenu(false); setMenuTrack(null); }} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, gap: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
});

export default FavoritesScreen;
