import React, {memo} from 'react';
import {View, StyleSheet, Dimensions} from 'react-native';

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

const COLS_ARR = Array.from({length: NUM_COLS}, (_, i) => i);
const ROWS_ARR = Array.from({length: NUM_ROWS}, (_, i) => i);

const getMatrixColor = (rowFromBottom: number): string => {
  const ratio = rowFromBottom / NUM_ROWS;
  if (ratio <= 0.3) return '#00E5FF';
  if (ratio <= 0.55) return '#00B8FF';
  if (ratio <= 0.8) return '#5A8CFF';
  return '#8B5CFF';
};

interface MatrixGridProps {
  levels: number[];
}

const MatrixGrid: React.FC<MatrixGridProps> = ({levels}) => (
  <View style={styles.grid}>
    {COLS_ARR.map(colIdx => {
      const level = levels[colIdx] || 0;
      const litCount = Math.max(1, Math.round(level * NUM_ROWS));
      return (
        <View key={colIdx} style={styles.column}>
          {ROWS_ARR.map(rowIdx => {
            const fromBottom = NUM_ROWS - 1 - rowIdx;
            const isLit = fromBottom < litCount;
            const matrixCellStyle = isLit
              ? {backgroundColor: getMatrixColor(fromBottom), opacity: 0.25 + (level || 0) * 0.75}
              : styles.matrixCellDim;
            return <View key={rowIdx} style={[styles.cell, matrixCellStyle]} />;
          })}
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  grid: {flexDirection: 'row', gap: COL_GAP},
  column: {gap: ROW_GAP},
  cell: {width: CELL_W, height: CELL_H, borderRadius: 2},
  matrixCellDim: {backgroundColor: 'rgba(25,25,36,0.22)'},
});

export default memo(MatrixGrid);
