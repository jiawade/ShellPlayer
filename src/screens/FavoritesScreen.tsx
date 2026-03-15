// src/screens/FavoritesScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackItem from '../components/TrackItem';
import TrackMenu from '../components/TrackMenu';
import { useAppSelector, useAppDispatch } from '../store';
import { playTrack, toggleFavorite } from '../store/musicSlice';
import { Track } from '../types';
import { COLORS, SIZES } from '../utils/theme';

const FavoritesScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { tracks, currentTrack, favoriteIds, repeatMode } = useAppSelector(s => s.music);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const favTracks = useMemo(() => tracks.filter(t => favoriteIds.includes(t.id)), [tracks, favoriteIds]);

  const handlePlay = useCallback((t: Track) => {
    dispatch(playTrack({ track: t, queue: favTracks, shuffle: repeatMode === 'queue' }));
  }, [dispatch, favTracks, repeatMode]);

  const handleFav = useCallback((id: string) => { dispatch(toggleFavorite(id)); }, [dispatch]);
  const handleOpenMenu = useCallback((t: Track) => { setMenuTrack(t); setShowMenu(true); }, []);

  const renderItem = useCallback(({ item }: { item: Track }) => (
    <TrackItem track={item} isActive={currentTrack?.id === item.id} onPress={handlePlay} onToggleFavorite={handleFav} onOpenMenu={handleOpenMenu} />
  ), [currentTrack?.id, handlePlay, handleFav, handleOpenMenu]);

  if (favTracks.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}><Icon name="heart-outline" size={72} color={COLORS.heartDim} /></View>
        <Text style={styles.emptyTitle}>还没有喜欢的歌曲</Text>
        <Text style={styles.emptySub}>点击歌曲旁的 ♡ 按钮{'\n'}将歌曲加入收藏</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>我喜欢的</Text>
        <View style={styles.badge}><Icon name="heart" size={14} color={COLORS.heart} /><Text style={styles.badgeTxt}>{favTracks.length}</Text></View>
      </View>
      <FlatList data={favTracks} renderItem={renderItem} keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={true}
        initialNumToRender={15} maxToRenderPerBatch={10} removeClippedSubviews={true} />
      <TrackMenu track={menuTrack} visible={showMenu} onClose={() => { setShowMenu(false); setMenuTrack(null); }} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, gap: 12 },
  title: { fontSize: SIZES.xxxl, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: COLORS.heartDim },
  badgeTxt: { fontSize: SIZES.sm, color: COLORS.heart, fontWeight: '600' },
  empty: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: SIZES.xl, fontWeight: '600', color: COLORS.textSecondary },
  emptySub: { fontSize: SIZES.md, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 },
});

export default FavoritesScreen;
