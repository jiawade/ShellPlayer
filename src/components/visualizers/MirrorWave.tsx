import React, { memo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const NUM_COLS = 16;
const COL_GAP = 3;
const GRID_H_PAD = 20;
const CELL_W = Math.floor((SCREEN_W - GRID_H_PAD * 2 - COL_GAP * (NUM_COLS - 1)) / NUM_COLS);
const LED_TARGET_H = Math.max(320, Math.floor(SCREEN_H * 0.56));

const COLS_ARR = Array.from({ length: NUM_COLS }, (_, i) => i);

interface MirrorWaveProps {
  levels: number[];
  hasAudibleSignal: boolean;
}

const MirrorWave: React.FC<MirrorWaveProps> = ({ levels, hasAudibleSignal }) => {
  const mirrorHeight = Math.min(LED_TARGET_H, Math.floor(SCREEN_H * 0.52));
  const halfHeight = Math.floor(mirrorHeight / 2);

  return (
    <View style={[styles.mirrorWrap, { height: mirrorHeight }]}>
      {COLS_ARR.map(i => {
        const lv = levels[i] || 0;
        const barH = hasAudibleSignal ? Math.max(0, Math.round(lv * (halfHeight - 6))) : 2;
        const alpha = 0.25 + lv * 0.75;
        return (
          <View key={i} style={styles.mirrorCol}>
            <View style={styles.mirrorCenterLine} />
            <View style={[styles.mirrorBar, styles.mirrorBarTop, { height: barH, opacity: alpha }]} />
            <View style={[styles.mirrorBar, styles.mirrorBarBottom, { height: barH, opacity: alpha }]} />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  mirrorWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: COL_GAP,
  },
  mirrorCol: {
    width: CELL_W,
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrorCenterLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mirrorBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 3,
    backgroundColor: '#53FFAF',
  },
  mirrorBarTop: { bottom: '50%' },
  mirrorBarBottom: { top: '50%' },
});

export default memo(MirrorWave);
