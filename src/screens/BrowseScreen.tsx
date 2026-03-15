// src/screens/BrowseScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

const BrowseScreen: React.FC = () => {
  const { colors, sizes } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>浏览</Text>
      <View style={styles.empty}>
        <Icon name="albums-outline" size={64} color={colors.textMuted} />
        <Text style={{ fontSize: sizes.xl, color: colors.textSecondary, marginTop: 16, fontWeight: '600' }}>
          按文件夹浏览
        </Text>
        <Text style={{ fontSize: sizes.md, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          即将推出
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 36, fontWeight: '800', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, letterSpacing: -0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
});

export default BrowseScreen;
