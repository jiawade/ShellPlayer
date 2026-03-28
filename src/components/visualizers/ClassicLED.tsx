import React, { memo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const NUM_COLS = 16;
const NUM_ROWS = 28;
const GRID_H_PAD = 20;
const COL_GAP = 3;
const ROW_GAP = 2;
const CELL_W = Math.floor((SCREEN_W - GRID_H_PAD * 2 - COL_GAP * (NUM_COLS - 1)) / NUM_COLS);
const LED_TARGET_H = Math.max(320, Math.floor(SCREEN_H * 0.56));
const BASE_CELL_H = Math.floor((LED_TARGET_H - ROW_GAP * (NUM_ROWS - 1)) / NUM_ROWS);
const CELL_H = Math.max(9, Math.min(16, BASE_CELL_H));

const COLS_ARR = Array.from({ length: NUM_COLS }, (_, i) => i);
const ROWS_ARR = Array.from({ length: NUM_ROWS }, (_, i) => i);

const getCellColor = (rowFromBottom: number): string => {
  const ratio = rowFromBottom / NUM_ROWS;
  if (ratio <= 0.3) return '#00FF44';
  if (ratio <= 0.5) return '#55FF00';
  if (ratio <= 0.65) return '#AAFF00';
  if (ratio <= 0.78) return '#FFD700';
  if (ratio <= 0.88) return '#FF8C00';
  if (ratio <= 0.94) return '#FF4500';
  return '#FF0000';
};

const DIM_COLOR = 'rgba(40, 40, 40, 0.3)';

interface ClassicLEDProps {
  levels: number[];
  peakLevels: number[];
}

const ClassicLED: React.FC<ClassicLEDProps> = ({ levels, peakLevels }) => (
  <View style={styles.grid}>
    {COLS_ARR.map(colIdx => {
      const level = levels[colIdx] || 0;
      const peak = peakLevels[colIdx] || 0;
      const litCount = Math.max(1, Math.round(level * NUM_ROWS));
      const peakRow = Math.min(Math.round(peak * NUM_ROWS), NUM_ROWS - 1);
      return (
        <View key={colIdx} style={styles.column}>
          {ROWS_ARR.map(rowIdx => {
            const fromBottom = NUM_ROWS - 1 - rowIdx;
            const isLit = fromBottom < litCount;
            const isPeak = fromBottom === peakRow && peakRow > 0;
            return (
              <View
                key={rowIdx}
                style={[
                  styles.cell,
                  { backgroundColor: isLit || isPeak ? getCellColor(fromBottom) : DIM_COLOR },
                ]}
              />
            );
          })}
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: COL_GAP },
  column: { gap: ROW_GAP },
  cell: { width: CELL_W, height: CELL_H, borderRadius: 2 },
});

export default memo(ClassicLED);
