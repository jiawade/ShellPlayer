// src/components/MiniPlayer.tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import CoverArt from './CoverArt';
import { useAppSelector, useAppDispatch } from '../store';
import { setShowFullPlayer } from '../store/musicSlice';
import { usePlayerControls, usePlayerSync } from '../hooks/usePlayerProgress';
import { COLORS, SIZES } from '../utils/theme';

const MiniPlayer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentTrack, isPlaying } = useAppSelector(s => s.music);
  const { togglePlayPause, skipToNext } = usePlayerControls();
  const { position, duration } = usePlayerSync();

  if (!currentTrack) return null;
  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.9}
      onPress={() => dispatch(setShowFullPlayer(true))}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.content}>
        <CoverArt artwork={currentTrack.artwork} size={48} borderRadius={10} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <Pressable onPress={togglePlayPause} style={styles.btn} hitSlop={10}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={26} color={COLORS.textPrimary} />
        </Pressable>
        <Pressable onPress={skipToNext} style={styles.btn} hitSlop={10}>
          <Icon name="play-forward" size={22} color={COLORS.textSecondary} />
        </Pressable>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.bgElevated, borderTopWidth: 1, borderTopColor: COLORS.border, overflow: 'hidden' },
  progressBar: { height: 2, backgroundColor: COLORS.border },
  progressFill: { height: '100%', backgroundColor: COLORS.accent },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  info: { flex: 1, marginLeft: 12 },
  title: { fontSize: SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  artist: { fontSize: SIZES.xs, color: COLORS.textSecondary },
  btn: { padding: 10 },
});

export default memo(MiniPlayer);
