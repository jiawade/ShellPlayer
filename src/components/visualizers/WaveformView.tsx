import React, {memo, useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, Dimensions} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const NUM_COLUMNS = 64;
const COL_PAD = 20;
const AVAILABLE_W = SCREEN_W - COL_PAD * 2;
const COL_W = Math.max(1, Math.floor(AVAILABLE_W / NUM_COLUMNS) - 1);
const WAVE_H = 200;
const HALF_H = WAVE_H / 2;

interface WaveformViewProps {
  levels: number[];
  beatLevel: number;
}

function interpolateBands(bands: number[], count: number): number[] {
  const result: number[] = [];
  const bandCount = bands.length;
  for (let i = 0; i < count; i++) {
    const pos = (i / (count - 1)) * (bandCount - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, bandCount - 1);
    const frac = pos - lo;
    result.push((bands[lo] ?? 0) * (1 - frac) + (bands[hi] ?? 0) * frac);
  }
  return result;
}

function getColumnColor(amplitude: number): string {
  const t = Math.min(1, amplitude);
  const r = Math.round(30 + t * 50);
  const g = Math.round(200 + t * 55);
  const b = Math.round(180 + t * 75);
  return `rgb(${r},${g},${b})`;
}

const WaveColumn = memo(
  ({index, amplitude, beatLevel}: {index: number; amplitude: number; beatLevel: number}) => {
    const heightAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const h = amplitude * HALF_H;
      Animated.timing(heightAnim, {
        toValue: h,
        duration: 60,
        useNativeDriver: false,
      }).start();
    }, [amplitude, heightAnim]);

    const isGlow = amplitude > 0.7;
    const color = getColumnColor(amplitude);
    const glowBoost = beatLevel > 0.5 ? 0.3 : 0;
    const opacity = 0.6 + Math.min(1, amplitude + glowBoost) * 0.4;

    return (
      <View
        key={index}
        style={[styles.colContainer, {width: COL_W}]}>
        {/* Upper half (mirrored upward) */}
        <Animated.View
          style={[
            styles.colBar,
            {
              width: COL_W,
              height: heightAnim,
              backgroundColor: color,
              opacity,
              ...(isGlow
                ? {
                    shadowColor: color,
                    shadowOffset: {width: 0, height: 0},
                    shadowOpacity: 0.7,
                    shadowRadius: 4,
                  }
                : {}),
            },
          ]}
        />
        {/* Lower half (mirrored downward) */}
        <Animated.View
          style={[
            styles.colBarLower,
            {
              width: COL_W,
              height: heightAnim,
              backgroundColor: color,
              opacity: opacity * 0.7,
            },
          ]}
        />
      </View>
    );
  },
);

const WaveformView: React.FC<WaveformViewProps> = ({levels, beatLevel}) => {
  const interpolated = interpolateBands(levels, NUM_COLUMNS);

  return (
    <View style={styles.container}>
      <View style={styles.centerLine} />
      <View style={styles.columnsRow}>
        {interpolated.map((amp, i) => (
          <WaveColumn key={i} index={i} amplitude={amp} beatLevel={beatLevel} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: COL_PAD,
  },
  centerLine: {
    position: 'absolute',
    width: AVAILABLE_W,
    height: 1,
    backgroundColor: 'rgba(0,230,255,0.15)',
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: WAVE_H,
    gap: 1,
  },
  colContainer: {
    height: WAVE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colBar: {
    position: 'absolute',
    bottom: '50%',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  colBarLower: {
    position: 'absolute',
    top: '50%',
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
});

export default memo(WaveformView);
