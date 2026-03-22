// src/screens/OnboardingScreen.tsx
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, SIZES } from '../utils/theme';

const { width } = Dimensions.get('window');

const PAGES = [
  { icon: 'musical-notes', colorBg: '#0B2E3D', key: 'page1' },
  { icon: 'options-outline', colorBg: '#1A0B3D', key: 'page2' },
  { icon: 'document-text-outline', colorBg: '#0B3D1A', key: 'page3' },
  { icon: 'shield-checkmark-outline', colorBg: '#3D0B1A', key: 'page4' },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleDone = async () => {
    await AsyncStorage.setItem('@onboarding_done', 'true');
    onDone();
  };

  const handleNext = () => {
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleDone();
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={[styles.page, { width, backgroundColor: item.colorBg }]}>
            <View style={styles.iconWrap}>
              <Icon name={item.icon} size={80} color={DARK_COLORS.accent} />
            </View>
            <Text style={styles.pageTitle}>{t(`onboarding.${item.key}.title`)}</Text>
            <Text style={styles.pageDesc}>{t(`onboarding.${item.key}.desc`)}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {currentIndex === PAGES.length - 1 ? t('onboarding.getStarted') : '→'}
          </Text>
        </TouchableOpacity>
      </View>

      {currentIndex < PAGES.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleDone}>
          <Text style={styles.skipText}>{t('onboarding.getStarted')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_COLORS.bg },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0,229,195,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  pageDesc: {
    fontSize: SIZES.lg,
    color: DARK_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: DARK_COLORS.accent, width: 24 },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  nextBtn: {
    backgroundColor: DARK_COLORS.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  nextBtnText: { color: DARK_COLORS.black, fontSize: 16, fontWeight: '700' },
  skipBtn: { position: 'absolute', top: 56, right: 24 },
  skipText: { color: DARK_COLORS.textSecondary, fontSize: 14 },
});
