// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { scanMusic, importiOSMediaLibrary } from '../store/musicSlice';
import FolderPickerScreen from './FolderPickerScreen';
import SwipeBackWrapper from '../components/SwipeBackWrapper';
import BatteryOptimizationGuide from '../components/BatteryOptimizationGuide';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const STORAGE_ROOT = '/storage/emulated/0';

const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { tracks, isScanning, scanDirectories } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);

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
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.stickyHeader, { backgroundColor: colors.bg }]}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

      {/* 通用设置 */}
      <TouchableOpacity style={[styles.navRow, { backgroundColor: colors.bgCard, borderColor: colors.border, marginBottom: 28 }]}
        onPress={() => navigation.navigate('GeneralSettings')} activeOpacity={0.7}>
        <Icon name="settings-outline" size={20} color={colors.accent} />
        <Text style={{ flex: 1, fontSize: sizes.md, fontWeight: '600', color: colors.textPrimary, marginLeft: 12 }}>{t('settings.general.title')}</Text>
        <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginRight: 8 }}>{t('settings.general.desc')}</Text>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

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

      {/* 关于 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('settings.about.title')}</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {[[t('settings.about.appName'), 'Music X'], [t('settings.about.version'), '1.0.0']].map(([k, v]) => (
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
    </ScrollView>
      <Modal visible={showFolderPicker} animationType="slide">
        <SwipeBackWrapper onSwipeBack={() => setShowFolderPicker(false)}>
          <FolderPickerScreen onConfirm={handleFolderConfirm} onCancel={() => setShowFolderPicker(false)} initialSelected={scanDirectories} />
        </SwipeBackWrapper>
      </Modal>
      <BatteryOptimizationGuide visible={showBatteryGuide} onClose={() => setShowBatteryGuide(false)} />
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
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '700' },
  statLbl: { fontSize: 10, marginTop: 4 },
  divider: { width: 1, height: 36 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 14, borderRadius: 12, gap: 8 },
  actionTxt: { fontSize: 14, fontWeight: '600' },
  dirItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  dirTxt: { flex: 1, fontSize: 12 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 16, borderRadius: 16, borderWidth: 1 },
});

export default SettingsScreen;
