import React, {memo, useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, Dimensions} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const NUM_BARS = 16;
const PAD_H = 24;
const BAR_GAP = 4;
const BAR_W = Math.floor((SCREEN_W - PAD_H * 2 - BAR_GAP * (NUM_BARS - 1)) / NUM_BARS);
const MAX_BAR_H = 220;
const SKEW_DEG = '-12deg';
const SIDE_W = 6;

interface Spectrum3DProps {
  levels: number[];
  beatLevel: number;
}

function getBarColor(index: number): {front: string; top: string; side: string} {
  const t = index / (NUM_BARS - 1);
  const r = Math.round(50 + t * 180);
  const g = Math.round(80 - t * 40);
  const b = Math.round(220 + t * 35);
  return {
    front: `rgb(${r},${g},${b})`,
    top: `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 30)},${Math.min(255, b + 20)})`,
    side: `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 20)},${Math.max(0, b - 30)})`,
  };
}

const Bar3D = memo(({index, level}: {index: number; level: number}) => {
  const heightAnim = useRef(new Animated.Value(4)).current;
  const colors = getBarColor(index);

  useEffect(() => {
    const h = Math.max(4, level * MAX_BAR_H);
    Animated.timing(heightAnim, {
      toValue: h,
      duration: 70,
      useNativeDriver: false,
    }).start();
  }, [level, heightAnim]);

  return (
    <View style={[styles.barWrapper, {width: BAR_W}]}>
      {/* Front face */}
      <Animated.View
        style={[
          styles.barFront,
          {
            width: BAR_W,
            height: heightAnim,
            backgroundColor: colors.front,
            transform: [{skewX: SKEW_DEG}],
          },
        ]}
      />
      {/* Top face */}
      <Animated.View
        style={[
          styles.barTop,
          {
            width: BAR_W,
            height: SIDE_W,
            backgroundColor: colors.top,
            transform: [{skewX: SKEW_DEG}, {translateY: -SIDE_W / 2}],
          },
        ]}
      />
      {/* Side face */}
      <Animated.View
        style={[
          styles.barSide,
          {
            width: SIDE_W,
            height: heightAnim,
            backgroundColor: colors.side,
            transform: [{skewY: '12deg'}],
          },
        ]}
      />
    </View>
  );
});

const GridLines = memo(() => {
  const lines = [];
  const count = 6;
  for (let i = 0; i <= count; i++) {
    const y = (i / count) * MAX_BAR_H;
    lines.push(
      <View
        key={i}
        style={[
          styles.gridLine,
          {bottom: y},
        ]}
      />,
    );
  }
  return <>{lines}</>;
});

const Spectrum3D: React.FC<Spectrum3DProps> = ({levels, beatLevel: _beatLevel}) => {
  return (
    <View style={styles.container}>
      <View style={styles.barsArea}>
        <GridLines />
        <View style={styles.barsRow}>
          {levels.slice(0, NUM_BARS).map((lvl, i) => (
            <Bar3D key={i} index={i} level={lvl} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PAD_H,
  },
  barsArea: {
    width: SCREEN_W - PAD_H * 2,
    height: MAX_BAR_H + SIDE_W + 20,
    justifyContent: 'flex-end',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(100,100,180,0.12)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  barWrapper: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  barFront: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  barTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  barSide: {
    position: 'absolute',
    bottom: 0,
    right: -SIDE_W,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});

export default memo(Spectrum3D);
