// src/components/MiniPlayer.tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import CoverArt from './CoverArt';
import { useAppSelector, useAppDispatch } from '../store';
import { setShowFullPlayer } from '../store/musicSlice';
import { usePlayerControls, usePlayerSync } from '../hooks/usePlayerProgress';
import { useTheme } from '../contexts/ThemeContext';
import { hapticMedium, hapticLight } from '../utils/haptics';

const MiniPlayer: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { currentTrack, isPlaying } = useAppSelector(s => s.music);
  const { togglePlayPause, skipToNext, skipToPrevious } = usePlayerControls();
  const { position, duration } = usePlayerSync();
  const { colors, sizes } = useTheme();

  if (!currentTrack) return null;
  const progress = duration > 0 ? position / duration : 0;

  const openFullPlayer = () => {
    dispatch(setShowFullPlayer(true));
    navigation.navigate('FullPlayer');
  };

  return (
    <TouchableOpacity
      style={{ backgroundColor: colors.bgElevated, borderTopWidth: 1, borderTopColor: colors.border, overflow: 'hidden' }}
      activeOpacity={0.9}
      onPress={openFullPlayer}
      accessibilityLabel={`${currentTrack.title} by ${currentTrack.artist}`}
      accessibilityRole="button"
      accessibilityHint="Open full player">
      <View style={{ height: 2, backgroundColor: colors.border }}>
        <View style={{ height: '100%', backgroundColor: colors.accent, width: `${progress * 100}%` }} />
      </View>
      <View style={styles.content}>
        <CoverArt artwork={currentTrack.artwork} size={48} borderRadius={10} />
        <View style={styles.info}>
          <Text style={{ fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 }} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={{ fontSize: sizes.xs, color: colors.textSecondary }} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <Pressable onPress={() => { hapticLight(); skipToPrevious(); }} style={styles.btn} hitSlop={10} accessibilityLabel="Previous track" accessibilityRole="button">
          <Icon name="play-back" size={22} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={() => { hapticMedium(); togglePlayPause(); }} style={styles.btn} hitSlop={10} accessibilityLabel={isPlaying ? 'Pause' : 'Play'} accessibilityRole="button">
          <Icon name={isPlaying ? 'pause' : 'play'} size={26} color={colors.textPrimary} style={isPlaying ? undefined : {marginLeft: 2}} />
        </Pressable>
        <Pressable onPress={() => { hapticLight(); skipToNext(); }} style={styles.btn} hitSlop={10} accessibilityLabel="Next track" accessibilityRole="button">
          <Icon name="play-forward" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  info: { flex: 1, marginLeft: 12 },
  btn: { padding: 10 },
});

export default memo(MiniPlayer);
