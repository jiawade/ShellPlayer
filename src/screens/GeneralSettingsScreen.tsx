// src/screens/GeneralSettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { loadBluetoothLyricsSetting, setBluetoothLyricsEnabled } from '../utils/bluetoothLyrics';
import { useAppDispatch, useAppSelector } from '../store';
import { setThemeMode, setHideDuplicates, setLanguage } from '../store/musicSlice';
import { deduplicateTracks } from '../utils/dedup';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeMode } from '../types';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24];
const LINE_HEIGHTS = [40, 44, 48, 52, 56, 60, 64];

const GeneralSettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { tracks, themeMode, hideDuplicates, language } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [lyricFontSize, setLyricFontSize] = useState(16);
  const [lyricLineHeight, setLyricLineHeight] = useState(52);
  const [btLyricsEnabled, setBtLyricsEnabled] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const currentLang = language || i18n.language;

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    dispatch(setLanguage(lang));
    setShowLangPicker(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem('@lyricSettings');
        if (data) { const s = JSON.parse(data); if (s.fontSize) setLyricFontSize(s.fontSize); if (s.lineHeight) setLyricLineHeight(s.lineHeight); }
      } catch {}
      try {
        const btVal = await loadBluetoothLyricsSetting();
        setBtLyricsEnabled(btVal);
      } catch {}
    })();
  }, []);

  const saveLyricSettings = async (fs: number, lh: number) => {
    setLyricFontSize(fs); setLyricLineHeight(lh);
    try { await AsyncStorage.setItem('@lyricSettings', JSON.stringify({ fontSize: fs, lineHeight: lh })); } catch {}
  };

  const handleThemeToggle = (mode: ThemeMode) => {
    dispatch(setThemeMode(mode));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.stickyHeader, { backgroundColor: colors.bg }]}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t('settings.general.title')}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

      {/* 主题切换 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('settings.theme.title')}</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.themeRow}>
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: colors.bgElevated }, themeMode === 'dark' && { backgroundColor: colors.accent }]}
              onPress={() => handleThemeToggle('dark')}>
              <Icon name="moon" size={18} color={themeMode === 'dark' ? colors.bg : colors.textMuted} />
              <Text style={[styles.themeTxt, { color: colors.textMuted }, themeMode === 'dark' && { color: colors.bg }]}>{t('settings.theme.dark')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: colors.bgElevated }, themeMode === 'light' && { backgroundColor: colors.accent }]}
              onPress={() => handleThemeToggle('light')}>
              <Icon name="sunny" size={18} color={themeMode === 'light' ? colors.bg : colors.textMuted} />
              <Text style={[styles.themeTxt, { color: colors.textMuted }, themeMode === 'light' && { color: colors.bg }]}>{t('settings.theme.light')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: colors.bgElevated }, themeMode === 'system' && { backgroundColor: colors.accent }]}
              onPress={() => handleThemeToggle('system')}>
              <Icon name="phone-portrait-outline" size={18} color={themeMode === 'system' ? colors.bg : colors.textMuted} />
              <Text style={[styles.themeTxt, { color: colors.textMuted }, themeMode === 'system' && { color: colors.bg }]}>{t('settings.theme.system')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 语言切换 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('settings.language.title')}</Text>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => setShowLangPicker(!showLangPicker)}
          activeOpacity={0.7}>
          <Text style={{ fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary }}>
            {SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.label || currentLang}
          </Text>
          <Icon name={showLangPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {showLangPicker && (
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 8 }]}>
            {SUPPORTED_LANGUAGES.map((lang, i) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langItem, i < SUPPORTED_LANGUAGES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                onPress={() => handleLanguageChange(lang.code)}>
                <Text style={{ fontSize: sizes.md, color: currentLang === lang.code ? colors.accent : colors.textPrimary, fontWeight: currentLang === lang.code ? '700' : '400' }}>
                  {lang.label}
                </Text>
                {currentLang === lang.code && <Icon name="checkmark" size={18} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 播放设置 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('settings.playback.title')}</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>{t('settings.playback.hideDuplicates')}</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 16 }}>{t('settings.playback.hideDuplicatesDesc')}</Text>
            </View>
            <Switch
              value={hideDuplicates}
              onValueChange={(v: boolean) => {
                dispatch(setHideDuplicates(v));
                if (v) {
                  const dedupedCount = deduplicateTracks(tracks).length;
                  const removedCount = tracks.length - dedupedCount;
                  if (removedCount > 0) {
                    Alert.alert(t('settings.playback.dedupeCompleteTitle'), t('settings.playback.dedupeMessage', { count: removedCount, total: dedupedCount }));
                  } else {
                    Alert.alert(t('settings.playback.dedupeCompleteTitle'), t('settings.playback.noDedupes'));
                  }
                }
              }}
              trackColor={{ false: colors.bgElevated, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      {/* 歌词设置 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('settings.lyrics.title')}</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>{t('settings.lyrics.fontSize')}</Text>
          <View style={styles.optionRow}>
            {FONT_SIZES.map(fs => (
              <TouchableOpacity key={fs} style={[styles.optionBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }, lyricFontSize === fs && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
                onPress={() => saveLyricSettings(fs, lyricLineHeight)}>
                <Text style={[styles.optionTxt, { color: colors.textMuted }, lyricFontSize === fs && { color: colors.accent }]}>{fs}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 16 }} />
          <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>{t('settings.lyrics.lineHeight')}</Text>
          <View style={styles.optionRow}>
            {LINE_HEIGHTS.map(lh => (
              <TouchableOpacity key={lh} style={[styles.optionBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }, lyricLineHeight === lh && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
                onPress={() => saveLyricSettings(lyricFontSize, lh)}>
                <Text style={[styles.optionTxt, { color: colors.textMuted }, lyricLineHeight === lh && { color: colors.accent }]}>{lh}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.resetBtn, { backgroundColor: colors.bgElevated }]} onPress={() => saveLyricSettings(16, 52)}>
            <Text style={{ fontSize: sizes.sm, color: colors.textMuted }}>{t('settings.lyrics.reset')}</Text>
          </TouchableOpacity>
        </View>
        {/* Bluetooth / CarPlay / Android Auto lyrics */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 12 }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>{t('settings.lyrics.btLyrics')}</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 16 }}>{t('settings.lyrics.btLyricsDesc')}</Text>
            </View>
            <Switch
              value={btLyricsEnabled}
              onValueChange={(v: boolean) => {
                setBtLyricsEnabled(v);
                setBluetoothLyricsEnabled(v);
              }}
              trackColor={{ false: colors.bgElevated, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      {/* 主题编辑器 */}
      <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={() => navigation.navigate('ThemeEditor')} activeOpacity={0.7}>
        <Icon name="color-palette-outline" size={20} color={colors.accent} />
        <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('themeEditor.title')}</Text>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* 播放统计 */}
      <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Statistics')} activeOpacity={0.7}>
        <Icon name="stats-chart-outline" size={20} color={colors.accent} />
        <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('statistics.title')}</Text>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={{ height: 140 }} />
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  stickyHeader: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20 },
  pageTitle: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  section: { marginBottom: 28 },
  secTitle: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  card: { borderRadius: 20, padding: 16, borderWidth: 1 },
  themeRow: { flexDirection: 'row', gap: 12 },
  themeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  themeTxt: { fontSize: 14, fontWeight: '600' },
  settingLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  optionTxt: { fontSize: 12, fontWeight: '600' },
  resetBtn: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  langItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 16, borderRadius: 16, borderWidth: 1 },
});

export default GeneralSettingsScreen;
