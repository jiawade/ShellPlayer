// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Platform, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { scanMusic, setThemeMode, setHideDuplicates, importiOSMediaLibrary, setLanguage } from '../store/musicSlice';
import { deduplicateTracks } from '../utils/dedup';
import FolderPickerScreen from './FolderPickerScreen';
import SwipeBackWrapper from '../components/SwipeBackWrapper';
import BatteryOptimizationGuide from '../components/BatteryOptimizationGuide';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeMode } from '../types';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';

const STORAGE_ROOT = '/storage/emulated/0';
const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24];
const LINE_HEIGHTS = [40, 44, 48, 52, 56, 60, 64];

const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { tracks, isScanning, scanDirectories, themeMode, hideDuplicates, language } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [lyricFontSize, setLyricFontSize] = useState(16);
  const [lyricLineHeight, setLyricLineHeight] = useState(52);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);

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
    })();
  }, []);

  const saveLyricSettings = async (fs: number, lh: number) => {
    setLyricFontSize(fs); setLyricLineHeight(lh);
    try { await AsyncStorage.setItem('@lyricSettings', JSON.stringify({ fontSize: fs, lineHeight: lh })); } catch {}
  };

  const handleThemeToggle = (mode: ThemeMode) => {
    dispatch(setThemeMode(mode));
    // React Context 会自动触发所有组件重新渲染，不需要手动 setThemeColors
  };

  const handleRescan = () => {
    if (Platform.OS === 'ios') {
      Alert.alert(t('settings.library.reimportTitle'), t('settings.library.reimportMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.import'), onPress: () => dispatch(importiOSMediaLibrary(undefined)) },
      ]);
    } else if (scanDirectories.length > 0) {
      Alert.alert(t('settings.library.rescanTitle'), t('settings.library.rescanMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.scan'), onPress: () => dispatch(scanMusic(scanDirectories)) },
      ]);
    } else { setShowFolderPicker(true); }
  };

  const handleFolderConfirm = (dirs: string[]) => { setShowFolderPicker(false); dispatch(scanMusic(dirs)); };
  const shortPath = (p: string) => p.replace(STORAGE_ROOT + '/', '').replace(STORAGE_ROOT, 'Internal Storage');

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>

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

      {/* 音乐库 */}
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

      {/* 音乐库 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('settings.library.title')}</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.statRow}>
            <View style={styles.stat}><Text style={[styles.statNum, { color: colors.accent }]}>{tracks.length}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>{t('settings.library.songCount')}</Text></View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}><Text style={[styles.statNum, { color: colors.accent }]}>{tracks.filter(t => t.lrcPath || t.embeddedLyrics).length}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>{t('settings.library.lyricsCount')}</Text></View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}><Text style={[styles.statNum, { color: colors.accent }]}>{tracks.filter(t => t.isFavorite).length}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>{t('settings.library.favorites')}</Text></View>
          </View>
        </View>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentDim }]} onPress={handleRescan} disabled={isScanning}>
          <Icon name={isScanning ? 'hourglass-outline' : 'refresh'} size={20} color={colors.accent} />
          <Text style={[styles.actionTxt, { color: colors.accent }]}>{isScanning ? t('settings.library.importing') : (Platform.OS === 'ios' ? t('settings.library.reimportLabel') : t('settings.library.rescanLabel'))}</Text>
        </TouchableOpacity>
      </View>

      {/* 音乐来源 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{Platform.OS === 'ios' ? t('settings.musicSource.iosTitle') : t('settings.musicSource.androidTitle')}</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {Platform.OS === 'ios' ? (
            <>
              <View style={[styles.dirItem, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Icon name="musical-notes" size={18} color={colors.secondary} />
                <Text style={[styles.dirTxt, { color: colors.textSecondary }]}>{t('settings.musicSource.ituneLabel')}</Text>
              </View>
              <View style={styles.dirItem}>
                <Icon name="folder" size={18} color={colors.secondary} />
                <Text style={[styles.dirTxt, { color: colors.textSecondary }]}>{t('settings.musicSource.documentsLabel')}</Text>
              </View>
            </>
          ) : (
            scanDirectories.length > 0 ? scanDirectories.map((dir, i) => (
              <View key={dir} style={[styles.dirItem, i < scanDirectories.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Icon name="folder" size={18} color={colors.secondary} />
                <Text style={[styles.dirTxt, { color: colors.textSecondary }]} numberOfLines={1}>{shortPath(dir)}</Text>
              </View>
            )) : <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: 8 }}>{t('settings.musicSource.notSet')}</Text>
          )}
        </View>
        {Platform.OS === 'ios' ? (
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, paddingHorizontal: 4, lineHeight: 16 }}>
            {t('settings.musicSource.iosHint')}
          </Text>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentDim }]} onPress={() => setShowFolderPicker(true)}>
            <Icon name="folder-open-outline" size={20} color={colors.accent} />
            <Text style={[styles.actionTxt, { color: colors.accent }]}>{t('settings.musicSource.modifyDirectories')}</Text>
          </TouchableOpacity>
        )}
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
      </View>

      {/* 关于 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('settings.about.title')}</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {[[t('settings.about.appName'), 'ShellPlayer'], [t('settings.about.version'), '2.0.0']].map(([k, v]) => (
            <View key={k} style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: sizes.md, color: colors.textMuted }}>{k}</Text>
              <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>{v}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('ThemeEditor')} activeOpacity={0.7}>
          <Icon name="color-palette-outline" size={20} color={colors.accent} />
          <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('themeEditor.title')}</Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Pro')} activeOpacity={0.7}>
          <Icon name="diamond-outline" size={20} color={colors.accent} />
          <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('settings.about.pro')}</Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Statistics')} activeOpacity={0.7}>
          <Icon name="stats-chart-outline" size={20} color={colors.textSecondary} />
          <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('statistics.title')}</Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {Platform.OS === 'android' && (
          <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => setShowBatteryGuide(true)} activeOpacity={0.7}>
            <Icon name="battery-half-outline" size={20} color={colors.secondary} />
            <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('battery.title')}</Text>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Licenses')} activeOpacity={0.7}>
          <Icon name="document-text-outline" size={20} color={colors.textSecondary} />
          <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('settings.about.licenses')}</Text>
          <Icon name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 140 }} />
      <Modal visible={showFolderPicker} animationType="slide">
        <SwipeBackWrapper onSwipeBack={() => setShowFolderPicker(false)}>
          <FolderPickerScreen onConfirm={handleFolderConfirm} onCancel={() => setShowFolderPicker(false)} initialSelected={scanDirectories} />
        </SwipeBackWrapper>
      </Modal>
      <BatteryOptimizationGuide visible={showBatteryGuide} onClose={() => setShowBatteryGuide(false)} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  pageTitle: { fontSize: 36, fontWeight: '800', paddingTop: 56, paddingBottom: 20, letterSpacing: -0.5 },
  section: { marginBottom: 28 },
  secTitle: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  card: { borderRadius: 20, padding: 16, borderWidth: 1 },
  themeRow: { flexDirection: 'row', gap: 12 },
  themeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  themeTxt: { fontSize: 14, fontWeight: '600' },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '700' },
  statLbl: { fontSize: 10, marginTop: 4 },
  divider: { width: 1, height: 36 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 14, borderRadius: 12, gap: 8 },
  actionTxt: { fontSize: 14, fontWeight: '600' },
  dirItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  dirTxt: { flex: 1, fontSize: 12 },
  settingLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  optionTxt: { fontSize: 12, fontWeight: '600' },
  resetBtn: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 16, borderRadius: 16, borderWidth: 1 },
  langItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
});

export default SettingsScreen;
