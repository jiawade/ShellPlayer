// src/components/CoverArt.tsx
import React, { memo, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  artwork?: string;
  size: number;
  borderRadius?: number;
}

const CoverArt: React.FC<Props> = ({ artwork, size, borderRadius = 12 }) => {
  const { colors } = useTheme();
  const [loadError, setLoadError] = useState(false);
  const showImage = !!artwork && !loadError;

  return (
    <View style={{ width: size, height: size, borderRadius, overflow: 'hidden',
      backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
      borderWidth: showImage ? 0 : 1, borderColor: colors.border,
    }}>
      <Icon name="musical-notes" size={size * 0.4} color={colors.accent} />
      {showImage && (
        <Image
          source={{ uri: artwork }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          resizeMode="cover"
          onError={() => setLoadError(true)}
        />
      )}
    </View>
  );
};

export default memo(CoverArt);
