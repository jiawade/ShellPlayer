import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const METER_PAD = 20;
const METER_W = (SCREEN_W - METER_PAD * 2 - 20) / 2;
const ARC_R = METER_W / 2 - 10;
const NEEDLE_LEN = ARC_R - 8;
const SCALE_MARKS = 11;

interface VUMeterProps {
  levels: number[];
  beatLevel: number;
}

const ScaleMarks = memo(() => {
  const marks = [];
  for (let i = 0; i < SCALE_MARKS; i++) {
    const angle = -45 + (90 * i) / (SCALE_MARKS - 1);
    const rad = (angle * Math.PI) / 180;
    const isRed = i >= SCALE_MARKS - 2;
    const r = ARC_R - 4;
    const x = Math.sin(rad) * r;
    const y = -Math.cos(rad) * r;
    marks.push(
      <View
        key={i}
        style={[
          styles.scaleMark,
          {
            transform: [{ translateX: x }, { translateY: y }, { rotate: `${angle}deg` }],
            backgroundColor: isRed ? '#FF3333' : '#AAFFAA',
          },
        ]}
      />,
    );
  }
  return <>{marks}</>;
});

const Needle = memo(({ animVal }: {animVal: Animated.Value}) => {
  const rotation = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '45deg'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.needle,
        {
          height: NEEDLE_LEN,
          transform: [{ rotate: rotation }],
        },
      ]}
    />
  );
});

const SingleMeter = memo(
  ({ label, level, peakOn }: {label: string; level: number; peakOn: boolean}) => {
    const animVal = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(animVal, {
        toValue: level,
        duration: 80,
        useNativeDriver: true,
      }).start();
    }, [level, animVal]);

    return (
      <View style={styles.meterContainer}>
        <Text style={styles.meterLabel}>{label}</Text>
        <View style={styles.arcArea}>
          <View style={styles.arcBorder} />
          <ScaleMarks />
          <Needle animVal={animVal} />
          <View style={styles.pivotDot} />
        </View>
        <View style={styles.peakRow}>
          <View style={[styles.peakLed, peakOn && styles.peakLedOn]} />
          <Text style={styles.peakText}>PEAK</Text>
        </View>
        <View style={styles.vuLabel}>
          <Text style={styles.vuText}>VU</Text>
        </View>
      </View>
    );
  },
);

const VUMeter: React.FC<VUMeterProps> = ({ levels, beatLevel: _beatLevel }) => {
  const leftLevel =
    levels.length >= 8
      ? levels.slice(0, 8).reduce((a, b) => a + b, 0) / 8
      : 0;
  const rightLevel =
    levels.length >= 16
      ? levels.slice(8, 16).reduce((a, b) => a + b, 0) / 8
      : 0;

  return (
    <View style={styles.container}>
      <SingleMeter label="L" level={leftLevel} peakOn={leftLevel > 0.9} />
      <SingleMeter label="R" level={rightLevel} peakOn={rightLevel > 0.9} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: METER_PAD,
  },
  meterContainer: {
    width: METER_W,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
  },
  meterLabel: {
    color: '#AAFFAA',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  arcArea: {
    width: METER_W - 20,
    height: ARC_R + 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  arcBorder: {
    position: 'absolute',
    bottom: 0,
    width: ARC_R * 2,
    height: ARC_R,
    borderTopLeftRadius: ARC_R,
    borderTopRightRadius: ARC_R,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: '#444',
  },
  scaleMark: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    height: 10,
    borderRadius: 1,
  },
  needle: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    backgroundColor: '#FF6644',
    borderRadius: 1,
    transformOrigin: 'bottom',
  },
  pivotDot: {
    position: 'absolute',
    bottom: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#666',
  },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  peakLed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#441111',
  },
  peakLedOn: {
    backgroundColor: '#FF0000',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  peakText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
  },
  vuLabel: {
    marginTop: 4,
  },
  vuText: {
    color: '#AAFFAA',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
});

export default memo(VUMeter);
