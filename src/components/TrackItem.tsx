// src/components/TrackItem.tsx
import React, { memo, useCallback, useState, useEffect } from 'react';
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
  batchMode?: boolean;
  batchSelected?: boolean;
}

const TrackItem: React.FC<Props> = ({ track, isActive, onPress, onToggleFavorite, onOpenMenu, batchMode, batchSelected }) => {
  // 本地状态实现即时响应，不等 Redux 更新
  const [localFav, setLocalFav] = useState(track.isFavorite);

  // 同步 Redux 状态变化
  useEffect(() => { setLocalFav(track.isFavorite); }, [track.isFavorite]);

  const handlePress = useCallback(() => onPress(track), [track, onPress]);
  const handleFav = useCallback(() => {
    setLocalFav(prev => !prev); // 立即切换
    onToggleFavorite(track.id); // 异步更新 Redux
  }, [track.id, onToggleFavorite]);
  const handleMenu = useCallback(() => onOpenMenu(track), [track, onOpenMenu]);

  return (
    <TouchableOpacity
      style={[styles.row, isActive && styles.activeRow, batchSelected && styles.batchRow]}
      onPress={handlePress}
      activeOpacity={0.7}>
      {batchMode && (
        <Icon name={batchSelected ? 'checkbox' : 'square-outline'} size={22}
          color={batchSelected ? COLORS.accent : COLORS.textMuted} style={{ marginRight: 8 }} />
      )}

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
        <Text style={[styles.title, isActive && { color: COLORS.accent }]} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
      </View>

      {!batchMode && (
        <>
          <Pressable onPress={handleFav} style={styles.iconBtn} hitSlop={8}>
            <Icon name={localFav ? 'heart' : 'heart-outline'} size={20} color={localFav ? COLORS.heart : COLORS.textMuted} />
          </Pressable>
          <Pressable onPress={handleMenu} style={styles.iconBtn} hitSlop={8}>
            <Icon name="ellipsis-vertical" size={18} color={COLORS.textMuted} />
          </Pressable>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 12, marginVertical: 3, borderRadius: SIZES.radius },
  activeRow: { backgroundColor: COLORS.accentDim },
  batchRow: { backgroundColor: 'rgba(0, 229, 195, 0.08)' },
  coverWrap: { position: 'relative' },
  bars: { position: 'absolute', bottom: 4, right: 4, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 3, backgroundColor: COLORS.accent, borderRadius: 2 },
  info: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  title: { fontSize: SIZES.lg, color: COLORS.textPrimary, fontWeight: '600', marginBottom: 3 },
  artist: { fontSize: SIZES.sm, color: COLORS.textSecondary },
  iconBtn: { padding: 6 },
});

export default memo(TrackItem);
