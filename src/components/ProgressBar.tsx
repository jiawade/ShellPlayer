// src/components/ProgressBar.tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { usePlayerControls } from '../hooks/usePlayerProgress';
import { formatTime } from '../utils/lrcParser';
import { COLORS, SIZES } from '../utils/theme';

const PADDING = 28;
const BAR_W = Dimensions.get('window').width - PADDING * 2;

interface Props { position: number; duration: number; }

const ProgressBar: React.FC<Props> = ({ position, duration }) => {
  const { seekTo } = usePlayerControls();
  const progress = duration > 0 ? position / duration : 0;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / BAR_W));
      seekTo(ratio * duration);
    },
    onPanResponderMove: (e) => {
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / BAR_W));
      seekTo(ratio * duration);
    },
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.barTouch} {...panResponder.panHandlers}>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
        </View>
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: PADDING, marginTop: 20 },
  barTouch: { height: 30, justifyContent: 'center' },
  barBg: { height: 4, backgroundColor: COLORS.bgElevated, borderRadius: 2, position: 'relative' },
  barFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -6, marginLeft: -8,
    width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6, elevation: 4,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  time: { fontSize: SIZES.xs, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
});

export default memo(ProgressBar);
