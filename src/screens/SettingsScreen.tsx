// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../store';
import { scanMusic, setThemeMode, importiOSMediaLibrary } from '../store/musicSlice';
import FolderPickerScreen from './FolderPickerScreen';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeMode } from '../types';

const STORAGE_ROOT = '/storage/emulated/0';
const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24];
const LINE_HEIGHTS = [40, 44, 48, 52, 56, 60, 64];

const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { tracks, isScanning, scanDirectories, themeMode } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [lyricFontSize, setLyricFontSize] = useState(16);
  const [lyricLineHeight, setLyricLineHeight] = useState(52);

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
      Alert.alert('重新导入', '确定要重新从音乐库导入吗？', [
        { text: '取消', style: 'cancel' },
        { text: '导入', onPress: () => dispatch(importiOSMediaLibrary()) },
      ]);
    } else if (scanDirectories.length > 0) {
      Alert.alert('重新扫描', '确定要重新扫描本地音乐吗？', [
        { text: '取消', style: 'cancel' },
        { text: '扫描', onPress: () => dispatch(scanMusic(scanDirectories)) },
      ]);
    } else { setShowFolderPicker(true); }
  };

  const handleFolderConfirm = (dirs: string[]) => { setShowFolderPicker(false); dispatch(scanMusic(dirs)); };
  const shortPath = (p: string) => p.replace(STORAGE_ROOT + '/', '').replace(STORAGE_ROOT, '内部存储');

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>设置</Text>

      {/* 主题切换 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>主题</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.themeRow}>
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: colors.bgElevated }, themeMode === 'dark' && { backgroundColor: colors.accent }]}
              onPress={() => handleThemeToggle('dark')}>
              <Icon name="moon" size={20} color={themeMode === 'dark' ? colors.bg : colors.textMuted} />
              <Text style={[styles.themeTxt, { color: colors.textMuted }, themeMode === 'dark' && { color: colors.bg }]}>深色</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: colors.bgElevated }, themeMode === 'light' && { backgroundColor: colors.accent }]}
              onPress={() => handleThemeToggle('light')}>
              <Icon name="sunny" size={20} color={themeMode === 'light' ? colors.bg : colors.textMuted} />
              <Text style={[styles.themeTxt, { color: colors.textMuted }, themeMode === 'light' && { color: colors.bg }]}>浅色</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 音乐库 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>音乐库</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.statRow}>
            <View style={styles.stat}><Text style={[styles.statNum, { color: colors.accent }]}>{tracks.length}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>首歌曲</Text></View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}><Text style={[styles.statNum, { color: colors.accent }]}>{tracks.filter(t => t.lrcPath || t.embeddedLyrics).length}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>有歌词</Text></View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}><Text style={[styles.statNum, { color: colors.accent }]}>{tracks.filter(t => t.isFavorite).length}</Text><Text style={[styles.statLbl, { color: colors.textMuted }]}>收藏</Text></View>
          </View>
        </View>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentDim }]} onPress={handleRescan} disabled={isScanning}>
          <Icon name={isScanning ? 'hourglass-outline' : 'refresh'} size={20} color={colors.accent} />
          <Text style={[styles.actionTxt, { color: colors.accent }]}>{isScanning ? '正在导入...' : (Platform.OS === 'ios' ? '重新导入音乐库' : '重新扫描')}</Text>
        </TouchableOpacity>
      </View>

      {/* 扫描目录 (仅 Android) */}
      {Platform.OS !== 'ios' && (
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>扫描目录</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {scanDirectories.length > 0 ? scanDirectories.map((dir, i) => (
            <View key={dir} style={[styles.dirItem, i < scanDirectories.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Icon name="folder" size={18} color={colors.secondary} />
              <Text style={[styles.dirTxt, { color: colors.textSecondary }]} numberOfLines={1}>{shortPath(dir)}</Text>
            </View>
          )) : <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: 8 }}>未设置</Text>}
        </View>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accentDim }]} onPress={() => setShowFolderPicker(true)}>
          <Icon name="folder-open-outline" size={20} color={colors.accent} />
          <Text style={[styles.actionTxt, { color: colors.accent }]}>修改扫描目录</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* 歌词设置 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>歌词显示</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>字体大小</Text>
          <View style={styles.optionRow}>
            {FONT_SIZES.map(fs => (
              <TouchableOpacity key={fs} style={[styles.optionBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }, lyricFontSize === fs && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
                onPress={() => saveLyricSettings(fs, lyricLineHeight)}>
                <Text style={[styles.optionTxt, { color: colors.textMuted }, lyricFontSize === fs && { color: colors.accent }]}>{fs}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 16 }} />
          <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>行距</Text>
          <View style={styles.optionRow}>
            {LINE_HEIGHTS.map(lh => (
              <TouchableOpacity key={lh} style={[styles.optionBtn, { backgroundColor: colors.bgElevated, borderColor: colors.border }, lyricLineHeight === lh && { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
                onPress={() => saveLyricSettings(lyricFontSize, lh)}>
                <Text style={[styles.optionTxt, { color: colors.textMuted }, lyricLineHeight === lh && { color: colors.accent }]}>{lh}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.resetBtn, { backgroundColor: colors.bgElevated }]} onPress={() => saveLyricSettings(16, 52)}>
            <Text style={{ fontSize: sizes.sm, color: colors.textMuted }}>恢复默认</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 关于 */}
      <View style={styles.section}>
        <Text style={[styles.secTitle, { color: colors.textMuted }]}>关于</Text>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {[['应用名称', 'ShellPlayer'], ['版本', '2.0.0']].map(([k, v]) => (
            <View key={k} style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: sizes.md, color: colors.textMuted }}>{k}</Text>
              <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 140 }} />
      <Modal visible={showFolderPicker} animationType="slide">
        <FolderPickerScreen onConfirm={handleFolderConfirm} onCancel={() => setShowFolderPicker(false)} initialSelected={scanDirectories} />
      </Modal>
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
});

export default SettingsScreen;
