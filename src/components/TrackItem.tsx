// src/components/TrackItem.tsx
import React, { memo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import CoverArt from './CoverArt';
import { Track } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  track: Track;
  isActive: boolean;
  onPress: (t: Track) => void;
  onToggleFavorite: (id: string) => void;
  onOpenMenu: (t: Track) => void;
  batchMode?: boolean;
  batchSelected?: boolean;
}

const TrackItem: React.FC<Props> = ({
  track,
  isActive,
  onPress,
  onToggleFavorite,
  onOpenMenu,
  batchMode,
  batchSelected,
}) => {
  const { colors, sizes } = useTheme();
  const [localFav, setLocalFav] = useState(track.isFavorite);

  useEffect(() => {
    setLocalFav(track.isFavorite);
  }, [track.isFavorite]);

  const handlePress = useCallback(() => onPress(track), [track, onPress]);
  const handleFav = useCallback(() => {
    setLocalFav(prev => !prev);
    onToggleFavorite(track.id);
  }, [track.id, onToggleFavorite]);
  const handleMenu = useCallback(() => onOpenMenu(track), [track, onOpenMenu]);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { borderRadius: sizes.radius },
        isActive && { backgroundColor: colors.accentDim },
        batchSelected && { backgroundColor: 'rgba(0, 229, 195, 0.08)' },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}>
      {batchMode && (
        <Icon
          name={batchSelected ? 'checkbox' : 'square-outline'}
          size={22}
          color={batchSelected ? colors.accent : colors.textMuted}
          style={{ marginRight: 8 }}
        />
      )}

      <View style={styles.coverWrap}>
        <CoverArt artwork={track.artwork} size={50} borderRadius={10} />
        {isActive && (
          <View style={styles.bars}>
            <View
              style={[styles.bar, { height: 10, backgroundColor: colors.accent }]}
            />
            <View
              style={[styles.bar, { height: 14, backgroundColor: colors.accent }]}
            />
            <View
              style={[styles.bar, { height: 8, backgroundColor: colors.accent }]}
            />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text
          style={[
            {
              fontSize: sizes.lg,
              color: colors.textPrimary,
              fontWeight: '600',
              marginBottom: 3,
            },
            isActive && { color: colors.accent },
          ]}
          numberOfLines={1}>
          {track.title}
        </Text>
        <Text
          style={{ fontSize: sizes.sm, color: colors.textSecondary }}
          numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      {!batchMode && (
        <>
          <Pressable onPress={handleFav} style={styles.iconBtn} hitSlop={8}>
            <Icon
              name={localFav ? 'heart' : 'heart-outline'}
              size={20}
              color={localFav ? colors.heart : colors.textMuted}
            />
          </Pressable>
          <Pressable onPress={handleMenu} style={styles.iconBtn} hitSlop={8}>
            <Icon name="ellipsis-vertical" size={18} color={colors.textMuted} />
          </Pressable>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginVertical: 3,
  },
  coverWrap: { position: 'relative' },
  bars: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: { width: 3, borderRadius: 2 },
  info: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  iconBtn: { padding: 6 },
});

export default memo(TrackItem);
