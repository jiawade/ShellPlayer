import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, Image, StyleSheet, LayoutChangeEvent, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  artworks: string[];
  size?: number;
  borderRadius?: number;
}

const GAP = 1.5;

function getDisplayCount(n: number): number {
  if (n >= 9) return 9;
  if (n >= 8) return 8;
  if (n >= 6) return 6;
  if (n >= 4) return 4;
  if (n >= 1) return 1;
  return 0;
}

const PlaylistCover: React.FC<Props> = ({ artworks, size: fixedSize, borderRadius = 12 }) => {
  const { colors } = useTheme();
  const [measured, setMeasured] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    setMeasured(prev => (prev === w ? prev : w));
  }, []);

  const s = fixedSize ?? measured;
  const count = getDisplayCount(artworks.length);
  const urls = useMemo(() => artworks.slice(0, count), [artworks, count]);

  const base: ViewStyle = fixedSize != null
    ? { width: fixedSize, height: fixedSize, borderRadius, overflow: 'hidden', backgroundColor: colors.bgElevated }
    : { width: '100%', aspectRatio: 1, borderRadius, overflow: 'hidden', backgroundColor: colors.bgElevated };

  if (count === 0 || s === 0) {
    return (
      <View
        style={[base, styles.center]}
        onLayout={fixedSize == null ? handleLayout : undefined}
      >
        <Icon name="musical-notes" size={Math.max((fixedSize ?? 80) * 0.4, 24)} color={colors.textMuted} />
      </View>
    );
  }

  const cell3 = (s - 2 * GAP) / 3;
  const cell2 = (s - GAP) / 2;

  const renderRow = (items: string[], cs: number, centered?: boolean) => (
    <View style={[styles.row, { gap: GAP }, centered && styles.rowCenter]}>
      {items.map((uri, i) => (
        <Image key={i} source={{ uri }} style={{ width: cs, height: cs }} resizeMode="cover" />
      ))}
    </View>
  );

  let grid: React.ReactNode;
  switch (count) {
    case 1:
      grid = (
        <Image source={{ uri: urls[0] }} style={{ width: s, height: s }} resizeMode="cover" />
      );
      break;
    case 4:
      grid = (
        <>
          {renderRow(urls.slice(0, 2), cell2)}
          {renderRow(urls.slice(2, 4), cell2)}
        </>
      );
      break;
    case 6:
      grid = (
        <>
          {renderRow(urls.slice(0, 3), cell3)}
          {renderRow(urls.slice(3, 6), cell3)}
        </>
      );
      break;
    case 8:
      grid = (
        <>
          {renderRow(urls.slice(0, 2), cell3, true)}
          {renderRow(urls.slice(2, 5), cell3)}
          {renderRow(urls.slice(5, 8), cell3)}
        </>
      );
      break;
    default: // 9
      grid = (
        <>
          {renderRow(urls.slice(0, 3), cell3)}
          {renderRow(urls.slice(3, 6), cell3)}
          {renderRow(urls.slice(6, 9), cell3)}
        </>
      );
  }

  return (
    <View
      style={[base, count !== 1 ? styles.gridWrap : null, count !== 1 ? { gap: GAP } : null]}
      onLayout={fixedSize == null ? handleLayout : undefined}
    >
      {grid}
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  rowCenter: { justifyContent: 'center' },
  gridWrap: { justifyContent: 'center' },
});

export default memo(PlaylistCover);
