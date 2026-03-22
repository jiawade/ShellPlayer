// src/screens/ProScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '../store';
import { setPro } from '../store/proSlice';
import { getProProduct, purchasePro, restorePurchases, listenForPurchases, initIAP } from '../utils/iap';
import type { Product } from 'react-native-iap';

const FEATURE_ICONS: Record<string, string> = {
  parametricEQ: 'options-outline',
  allVisualizers: 'color-palette-outline',
  smartPlaylists: 'list-outline',
  lyricsSearch: 'search-outline',
  audioAnalyzer: 'analytics-outline',
  tagEditor: 'pricetag-outline',
  statistics: 'stats-chart-outline',
  carMode: 'car-outline',
  customThemes: 'brush-outline',
  gapless: 'infinite-outline',
};

export default function ProScreen() {
  const { t } = useTranslation();
  const { colors, sizes } = useTheme();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const isPro = useAppSelector(s => s.pro.isPro);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [iapError, setIapError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initIAP();
        const p = await getProProduct();
        setProduct(p);
      } catch {
        setIapError(true);
      }
    })();
    try {
      listenForPurchases(() => dispatch(setPro()));
    } catch {}
  }, [dispatch]);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      await purchasePro();
    } catch {}
    setLoading(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        dispatch(setPro());
      } else {
        Alert.alert(t('common.hint'), t('pro.restore'));
      }
    } catch {
      Alert.alert(t('common.hint'), t('pro.restore'));
    }
    setRestoring(false);
  };

  const features = Object.keys(FEATURE_ICONS);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Icon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('pro.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentDim }]}>
            <Icon name="diamond-outline" size={48} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('pro.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('pro.subtitle')}</Text>
        </View>

        <View style={[styles.featureList, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {features.map((key) => (
            <View key={key} style={[styles.featureRow, { borderBottomColor: colors.border }]}>
              <Icon name={FEATURE_ICONS[key]} size={20} color={colors.accent} />
              <Text style={[styles.featureText, { color: colors.textPrimary, fontSize: sizes.md }]}>
                {t(`pro.features.${key}`)}
              </Text>
              <Icon name="checkmark-circle" size={18} color={colors.accent} />
            </View>
          ))}
        </View>

        {isPro ? (
          <View style={[styles.purchasedBadge, { backgroundColor: colors.accentDim }]}>
            <Icon name="checkmark-circle" size={20} color={colors.accent} />
            <Text style={[styles.purchasedText, { color: colors.accent }]}>{t('pro.purchased')}</Text>
          </View>
        ) : (
          <View style={styles.purchaseSection}>
            <TouchableOpacity
              style={[styles.purchaseBtn, { backgroundColor: iapError ? colors.bgElevated : colors.accent }]}
              onPress={iapError ? undefined : handlePurchase}
              disabled={loading || iapError}>
              {loading ? (
                <ActivityIndicator color={colors.black} />
              ) : (
                <Text style={[styles.purchaseBtnText, { color: iapError ? colors.textMuted : colors.black }]}>
                  {iapError
                    ? t('pro.storeUnavailable')
                    : `${t('pro.purchase')} ${product?.localizedPrice ? `- ${product.localizedPrice}` : ''}`}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring || iapError}>
              <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
                {restoring ? '...' : t('pro.restore')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  content: { padding: 20, paddingBottom: 40 },
  heroSection: { alignItems: 'center', marginBottom: 28 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14 },
  featureList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 28 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 0.5,
  },
  featureText: { flex: 1 },
  purchaseSection: { alignItems: 'center', gap: 12 },
  purchaseBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  purchaseBtnText: { fontSize: 17, fontWeight: '700' },
  restoreBtn: { paddingVertical: 8 },
  restoreText: { fontSize: 13 },
  purchasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
  },
  purchasedText: { fontSize: 16, fontWeight: '600' },
});
