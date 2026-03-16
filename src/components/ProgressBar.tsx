// src/components/ProgressBar.tsx
import React, { memo, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { usePlayerControls } from '../hooks/usePlayerProgress';
import { formatTime } from '../utils/lrcParser';
import { useTheme } from '../contexts/ThemeContext';

const PADDING = 28;
const BAR_W = Dimensions.get('window').width - PADDING * 2;

interface Props { position: number; duration: number; }

const ProgressBar: React.FC<Props> = ({ position, duration }) => {
  const { seekTo } = usePlayerControls();
  const { colors, sizes } = useTheme();
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const seekRef = useRef(seekTo);
  seekRef.current = seekTo;

  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState(0);
  const dragRatioRef = useRef(0);

  const progress = dragging ? dragRatio : (duration > 0 ? position / duration : 0);
  const displayPosition = dragging ? dragRatio * duration : position;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / BAR_W));
      dragRatioRef.current = ratio;
      setDragging(true);
      setDragRatio(ratio);
    },
    onPanResponderMove: (e) => {
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / BAR_W));
      dragRatioRef.current = ratio;
      setDragRatio(ratio);
    },
    onPanResponderRelease: () => {
      seekRef.current(dragRatioRef.current * durationRef.current);
      setDragging(false);
    },
    onPanResponderTerminate: () => {
      setDragging(false);
    },
  }), []);

  return (
    <View style={{ paddingHorizontal: PADDING, marginTop: 20 }}>
      <View style={styles.barTouch} {...panResponder.panHandlers}>
        <View style={[styles.barBg, { backgroundColor: colors.bgElevated }]}>
          <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
          <View style={[styles.thumb, {
            left: `${progress * 100}%`,
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
          }]} />
        </View>
      </View>
      <View style={styles.times}>
        <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{formatTime(displayPosition)}</Text>
        <Text style={{ fontSize: sizes.xs, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  barTouch: { height: 30, justifyContent: 'center' },
  barBg: { height: 4, borderRadius: 2, position: 'relative' },
  barFill: { height: '100%', borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -6, marginLeft: -8,
    width: 16, height: 16, borderRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6, elevation: 4,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});

export default memo(ProgressBar);
