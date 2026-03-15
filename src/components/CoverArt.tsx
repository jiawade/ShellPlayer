// src/components/CoverArt.tsx
import React, { memo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../utils/theme';

interface Props {
  artwork?: string;
  size: number;
  borderRadius?: number;
}

const CoverArt: React.FC<Props> = ({ artwork, size, borderRadius = 12 }) => {
  if (artwork) {
    return (
      <Image
        source={{ uri: artwork }}
        style={{ width: size, height: size, borderRadius, backgroundColor: COLORS.bgCard }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius }]}>
      <Icon name="musical-notes" size={size * 0.4} color={COLORS.accent} />
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#1A1F35',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
});

export default memo(CoverArt);
