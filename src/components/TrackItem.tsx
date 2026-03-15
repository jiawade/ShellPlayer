// src/components/TrackItem.tsx
import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import CoverArt from './CoverArt';
import { Track } from '../types';
import { COLORS, SIZES } from '../utils/theme';

interface Props {
  track: Track;
  isActive: boolean;
  onPress: (t: Track) => void;
  onToggleFavorite: (id: string) => void;
  onOpenMenu: (t: Track) => void;
}

const TrackItem: React.FC<Props> = ({ track, isActive, onPress, onToggleFavorite, onOpenMenu }) => {
  const handlePress = useCallback(() => onPress(track), [track, onPress]);
  const handleFav = useCallback(() => onToggleFavorite(track.id), [track.id, onToggleFavorite]);
  const handleMenu = useCallback(() => onOpenMenu(track), [track, onOpenMenu]);

  return (
    <TouchableOpacity
      style={[styles.row, isActive && styles.activeRow]}
      onPress={handlePress}
      activeOpacity={0.7}>
      <View style={styles.coverWrap}>
        <CoverArt artwork={track.artwork} size={50} borderRadius={10} />
        {isActive && (
          <View style={styles.bars}>
            <View style={[styles.bar, { height: 10 }]} />
            <View style={[styles.bar, { height: 14 }]} />
            <View style={[styles.bar, { height: 8 }]} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, isActive && { color: COLORS.accent }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      <Pressable onPress={handleFav} style={styles.iconBtn} hitSlop={8}>
        <Icon
          name={track.isFavorite ? 'heart' : 'heart-outline'}
          size={20}
          color={track.isFavorite ? COLORS.heart : COLORS.textMuted}
        />
      </Pressable>

      <Pressable onPress={handleMenu} style={styles.iconBtn} hitSlop={8}>
        <Icon name="ellipsis-vertical" size={18} color={COLORS.textMuted} />
      </Pressable>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    marginHorizontal: 12, marginVertical: 3,
    borderRadius: SIZES.radius,
  },
  activeRow: { backgroundColor: COLORS.accentDim },
  coverWrap: { position: 'relative' },
  bars: {
    position: 'absolute', bottom: 4, right: 4,
    flexDirection: 'row', alignItems: 'flex-end', gap: 2,
  },
  bar: { width: 3, backgroundColor: COLORS.accent, borderRadius: 2 },
  info: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  title: { fontSize: SIZES.lg, color: COLORS.textPrimary, fontWeight: '600', marginBottom: 3 },
  artist: { fontSize: SIZES.sm, color: COLORS.textSecondary },
  iconBtn: { padding: 6 },
});

export default memo(TrackItem);
