// src/screens/LicensesScreen.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

const LICENSES = [
  { name: 'react-native', license: 'MIT', url: 'https://github.com/facebook/react-native' },
  { name: 'react-native-track-player', license: 'Apache-2.0', url: 'https://github.com/doublesymmetry/react-native-track-player' },
  { name: '@reduxjs/toolkit', license: 'MIT', url: 'https://github.com/reduxjs/redux-toolkit' },
  { name: 'react-redux', license: 'MIT', url: 'https://github.com/reduxjs/react-redux' },
  { name: 'react-navigation', license: 'MIT', url: 'https://github.com/react-navigation/react-navigation' },
  { name: 'react-native-vector-icons', license: 'MIT', url: 'https://github.com/oblador/react-native-vector-icons' },
  { name: 'react-native-fs', license: 'MIT', url: 'https://github.com/itinance/react-native-fs' },
  { name: 'async-storage', license: 'MIT', url: 'https://github.com/react-native-async-storage/async-storage' },
  { name: 'i18next', license: 'MIT', url: 'https://github.com/i18next/i18next' },
  { name: 'react-native-iap', license: 'MIT', url: 'https://github.com/dooboolab-community/react-native-iap' },
  { name: 'react-native-localize', license: 'MIT', url: 'https://github.com/zoontek/react-native-localize' },
  { name: 'pinyin-pro', license: 'MIT', url: 'https://github.com/zh-lx/pinyin-pro' },
  { name: 'iconv-lite', license: 'MIT', url: 'https://github.com/ashtuchkin/iconv-lite' },
  { name: 'SwiftAudioEx', license: 'MIT', url: 'https://github.com/nicklama/SwiftAudioEx' },
  { name: 'buffer', license: 'MIT', url: 'https://github.com/feross/buffer' },
];

export default function LicensesScreen() {
  const { t } = useTranslation();
  const { colors, sizes } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Icon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.about.licenses')}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {LICENSES.map((lib) => (
          <View key={lib.name} style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.libName, { color: colors.textPrimary, fontSize: sizes.md }]}>{lib.name}</Text>
            <Text style={[styles.libLicense, { color: colors.textSecondary, fontSize: sizes.sm }]}>{lib.license}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  list: { padding: 16 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  libName: { fontWeight: '500' },
  libLicense: {},
});
