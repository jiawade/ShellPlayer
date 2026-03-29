// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../store';
import BatteryOptimizationGuide from '../components/BatteryOptimizationGuide';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { tracks } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.stickyHeader, { backgroundColor: colors.bg }]}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* 通用设置 */}
        <TouchableOpacity
          style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('GeneralSettings')}
          activeOpacity={0.7}>
          <Icon name="settings-outline" size={20} color={colors.accent} />
          <Text
            style={{
              flex: 1,
              fontSize: sizes.md,
              fontWeight: '600',
              color: colors.textPrimary,
              marginLeft: 12,
            }}>
            {t('settings.general.title')}
          </Text>
          <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginRight: 8 }}>
            {t('settings.general.desc')}
          </Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 导入歌曲 */}
        <TouchableOpacity
          style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('ImportSongs')}
          activeOpacity={0.7}>
          <Icon name="musical-notes-outline" size={20} color={colors.accent} />
          <Text
            style={{
              flex: 1,
              fontSize: sizes.md,
              fontWeight: '600',
              color: colors.textPrimary,
              marginLeft: 12,
            }}>
            {t('settings.library.title')}
          </Text>
          <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginRight: 8 }}>
            {tracks.length} {t('settings.library.songCount')}
          </Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Pro */}
        <TouchableOpacity
          style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Pro')}
          activeOpacity={0.7}>
          <Icon name="diamond-outline" size={20} color={colors.accent} />
          <Text
            style={{
              flex: 1,
              fontSize: sizes.md,
              fontWeight: '600',
              color: colors.textPrimary,
              marginLeft: 12,
            }}>
            {t('settings.about.pro')}
          </Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* 电池优化 (Android) */}
        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => setShowBatteryGuide(true)}
            activeOpacity={0.7}>
            <Icon name="battery-half-outline" size={20} color={colors.secondary} />
            <Text
              style={{
                flex: 1,
                fontSize: sizes.md,
                fontWeight: '600',
                color: colors.textPrimary,
                marginLeft: 12,
              }}>
              {t('battery.title')}
            </Text>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* 关于 — 放在最底部 */}
        <View style={styles.aboutSection}>
          <Text style={[styles.secTitle, { color: colors.textMuted }]}>
            {t('settings.about.title')}
          </Text>
          <View
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {[
              [t('settings.about.appName'), 'Music X'],
              [t('settings.about.version'), '1.0.0'],
            ].map(([k, v]) => (
              <View key={k} style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
                <Text style={{ fontSize: sizes.md, color: colors.textMuted }}>{k}</Text>
                <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>
                  {v}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.aboutRow, { borderBottomWidth: 0 }]}
              onPress={() => navigation.navigate('Licenses')}
              activeOpacity={0.7}>
              <Text style={{ fontSize: sizes.md, color: colors.textMuted }}>
                {t('settings.about.licenses')}
              </Text>
              <Icon name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>
      <BatteryOptimizationGuide
        visible={showBatteryGuide}
        onClose={() => setShowBatteryGuide(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  stickyHeader: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20 },
  pageTitle: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  secTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  card: { borderRadius: 20, padding: 16, borderWidth: 1 },
  aboutSection: { marginTop: 20 },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
});

export default SettingsScreen;
