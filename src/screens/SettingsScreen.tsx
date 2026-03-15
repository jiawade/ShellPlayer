// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '../store';
import { scanMusic } from '../store/musicSlice';
import FolderPickerScreen from './FolderPickerScreen';
import { COLORS, SIZES } from '../utils/theme';
import { getLogDirectory } from '../utils/crashLogger';

const STORAGE_ROOT = '/storage/emulated/0';

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24];
const LINE_HEIGHTS = [40, 44, 48, 52, 56, 60, 64];

const SettingsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { tracks, isScanning, scanDirectories } = useAppSelector(s => s.music);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // 歌词设置
  const [lyricFontSize, setLyricFontSize] = useState(16);
  const [lyricLineHeight, setLyricLineHeight] = useState(52);

  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem('@lyricSettings');
        if (data) {
          const s = JSON.parse(data);
          if (s.fontSize) setLyricFontSize(s.fontSize);
          if (s.lineHeight) setLyricLineHeight(s.lineHeight);
        }
      } catch {}
    })();
  }, []);

  const saveLyricSettings = async (fs: number, lh: number) => {
    setLyricFontSize(fs);
    setLyricLineHeight(lh);
    try {
      await AsyncStorage.setItem('@lyricSettings', JSON.stringify({ fontSize: fs, lineHeight: lh }));
    } catch {}
  };

  const handleRescan = () => {
    if (scanDirectories.length > 0) {
      Alert.alert('重新扫描', '确定要重新扫描本地音乐吗？', [
        { text: '取消', style: 'cancel' },
        { text: '扫描', onPress: () => dispatch(scanMusic(scanDirectories)) },
      ]);
    } else {
      setShowFolderPicker(true);
    }
  };

  const handleFolderConfirm = (dirs: string[]) => {
    setShowFolderPicker(false);
    dispatch(scanMusic(dirs));
  };

  const shortPath = (p: string) => p.replace(STORAGE_ROOT + '/', '').replace(STORAGE_ROOT, '内部存储');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>设置</Text>

      {/* 音乐库 */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>音乐库</Text>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <View style={styles.stat}><Text style={styles.statNum}>{tracks.length}</Text><Text style={styles.statLbl}>首歌曲</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statNum}>{tracks.filter(t => t.lrcPath || t.embeddedLyrics).length}</Text><Text style={styles.statLbl}>有歌词</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statNum}>{tracks.filter(t => t.isFavorite).length}</Text><Text style={styles.statLbl}>收藏</Text></View>
          </View>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRescan} disabled={isScanning} activeOpacity={0.7}>
          <Icon name={isScanning ? 'hourglass-outline' : 'refresh'} size={20} color={COLORS.accent} />
          <Text style={styles.actionTxt}>{isScanning ? '正在扫描...' : '重新扫描'}</Text>
        </TouchableOpacity>
      </View>

      {/* 扫描目录 */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>扫描目录</Text>
        <View style={styles.card}>
          {scanDirectories.length > 0 ? scanDirectories.map((dir, i) => (
            <View key={dir} style={[styles.dirItem, i < scanDirectories.length - 1 && styles.dirBorder]}>
              <Icon name="folder" size={18} color={COLORS.secondary} />
              <Text style={styles.dirTxt} numberOfLines={1}>{shortPath(dir)}</Text>
            </View>
          )) : <Text style={styles.noDirTxt}>未设置扫描目录</Text>}
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowFolderPicker(true)} activeOpacity={0.7}>
          <Icon name="folder-open-outline" size={20} color={COLORS.accent} />
          <Text style={styles.actionTxt}>修改扫描目录</Text>
        </TouchableOpacity>
      </View>

      {/* 歌词设置 */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>歌词显示</Text>
        <View style={styles.card}>
          {/* 字体大小 */}
          <Text style={styles.settingLabel}>字体大小</Text>
          <View style={styles.optionRow}>
            {FONT_SIZES.map(fs => (
              <TouchableOpacity
                key={fs}
                style={[styles.optionBtn, lyricFontSize === fs && styles.optionBtnActive]}
                onPress={() => saveLyricSettings(fs, lyricLineHeight)}>
                <Text style={[styles.optionTxt, lyricFontSize === fs && styles.optionTxtActive]}>{fs}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.settingSpacer} />

          {/* 行距 */}
          <Text style={styles.settingLabel}>行距（高度）</Text>
          <View style={styles.optionRow}>
            {LINE_HEIGHTS.map(lh => (
              <TouchableOpacity
                key={lh}
                style={[styles.optionBtn, lyricLineHeight === lh && styles.optionBtnActive]}
                onPress={() => saveLyricSettings(lyricFontSize, lh)}>
                <Text style={[styles.optionTxt, lyricLineHeight === lh && styles.optionTxtActive]}>{lh}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.settingSpacer} />

          {/* 预览 */}
          <Text style={styles.settingLabel}>预览</Text>
          <View style={styles.previewBox}>
            <Text style={[styles.previewPast, { fontSize: lyricFontSize, lineHeight: lyricFontSize * 1.8 }]}>上一句歌词示例</Text>
            <View style={{ minHeight: lyricLineHeight, justifyContent: 'center', backgroundColor: 'rgba(0,229,195,0.1)', borderRadius: 8, paddingHorizontal: 8 }}>
              <Text style={{ fontSize: lyricFontSize + 6, lineHeight: (lyricFontSize + 6) * 1.6, color: COLORS.accent, fontWeight: '700', textAlign: 'center' }}>
                当前播放歌词示例
              </Text>
            </View>
            <Text style={[styles.previewNext, { fontSize: lyricFontSize, lineHeight: lyricFontSize * 1.8 }]}>下一句歌词示例</Text>
          </View>

          {/* 恢复默认 */}
          <TouchableOpacity style={styles.resetBtn} onPress={() => saveLyricSettings(16, 52)}>
            <Text style={styles.resetTxt}>恢复默认</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 调试 */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>调试</Text>
        <View style={styles.card}>
          <View style={styles.dirItem}>
            <Icon name="document-text-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.dirTxt} selectable numberOfLines={2}>{getLogDirectory()}</Text>
          </View>
        </View>
      </View>

      {/* 关于 */}
      <View style={styles.section}>
        <Text style={styles.secTitle}>关于</Text>
        <View style={styles.card}>
          {[['应用名称', 'ShellPlayer'], ['版本', '2.0.0'], ['技术栈', 'React Native + TypeScript']].map(([k, v]) => (
            <View key={k} style={styles.aboutRow}>
              <Text style={styles.aboutK}>{k}</Text><Text style={styles.aboutV}>{v}</Text>
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
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20 },
  pageTitle: { fontSize: SIZES.xxxl, fontWeight: '800', color: COLORS.textPrimary, paddingTop: 56, paddingBottom: 20, letterSpacing: -0.5 },
  section: { marginBottom: 28 },
  secTitle: { fontSize: SIZES.xs, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  card: { backgroundColor: COLORS.bgCard, borderRadius: SIZES.radiusLg, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.accent },
  statLbl: { fontSize: SIZES.xs, color: COLORS.textMuted, marginTop: 4 },
  divider: { width: 1, height: 36, backgroundColor: COLORS.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 14, borderRadius: SIZES.radius, backgroundColor: COLORS.accentDim, gap: 8 },
  actionTxt: { fontSize: SIZES.md, color: COLORS.accent, fontWeight: '600' },
  dirItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  dirBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dirTxt: { flex: 1, fontSize: SIZES.sm, color: COLORS.textSecondary },
  noDirTxt: { fontSize: SIZES.md, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },
  // 歌词设置
  settingLabel: { fontSize: SIZES.sm, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  settingSpacer: { height: 16 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border },
  optionBtnActive: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  optionTxt: { fontSize: SIZES.sm, color: COLORS.textMuted, fontWeight: '600' },
  optionTxtActive: { color: COLORS.accent },
  previewBox: { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, gap: 4, marginTop: 4 },
  previewPast: { color: COLORS.textSecondary, opacity: 0.7, textAlign: 'center' },
  previewNext: { color: COLORS.textMuted, textAlign: 'center' },
  resetBtn: { marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.bgElevated },
  resetTxt: { fontSize: SIZES.sm, color: COLORS.textMuted },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  aboutK: { fontSize: SIZES.md, color: COLORS.textMuted },
  aboutV: { fontSize: SIZES.md, color: COLORS.textPrimary, fontWeight: '500' },
});

export default SettingsScreen;
