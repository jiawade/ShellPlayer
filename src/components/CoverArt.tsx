// src/components/CoverArt.tsx
import React, { memo } from 'react';
import { View, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  artwork?: string;
  size: number;
  borderRadius?: number;
}

const CoverArt: React.FC<Props> = ({ artwork, size, borderRadius = 12 }) => {
  const { colors } = useTheme();

  if (artwork) {
    return (
      <Image
        source={{ uri: artwork }}
        style={{ width: size, height: size, borderRadius, backgroundColor: colors.bgCard }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius,
      backgroundColor: colors.bgElevated,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    }}>
      <Icon name="musical-notes" size={size * 0.4} color={colors.accent} />
    </View>
  );
};

export default memo(CoverArt);
