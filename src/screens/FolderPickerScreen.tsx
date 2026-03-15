// src/screens/FolderPickerScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { listSubDirectories } from '../utils/scanner';
import { COLORS, SIZES } from '../utils/theme';

const STORAGE_ROOT = '/storage/emulated/0';

const COMMON_DIRS = [
  { name: 'Music', path: `${STORAGE_ROOT}/Music` },
  { name: 'Download', path: `${STORAGE_ROOT}/Download` },
  { name: 'Documents', path: `${STORAGE_ROOT}/Documents` },
  { name: '网易云音乐', path: `${STORAGE_ROOT}/netease/cloudmusic/Music` },
  { name: 'QQ音乐', path: `${STORAGE_ROOT}/qqmusic/song` },
  { name: '酷狗音乐', path: `${STORAGE_ROOT}/kugou/download` },
];

interface Props {
  onConfirm: (dirs: string[]) => void;
  onCancel: () => void;
  initialSelected?: string[];
}

const FolderPickerScreen: React.FC<Props> = ({ onConfirm, onCancel, initialSelected = [] }) => {
  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(new Set(initialSelected));
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [subDirs, setSubDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!browsePath) return;
    setLoading(true);
    listSubDirectories(browsePath).then(dirs => {
      setSubDirs(dirs);
      setLoading(false);
    });
  }, [browsePath]);

  const toggleDir = useCallback((dir: string) => {
    setSelectedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }, []);

  const handleConfirm = () => {
    const dirs = Array.from(selectedDirs);
    if (dirs.length === 0) {
      Alert.alert('提示', '请至少选择一个目录');
      return;
    }
    onConfirm(dirs);
  };

  const handleScanAll = () => {
    onConfirm(COMMON_DIRS.map(d => d.path));
  };

  const dirName = (path: string) => path.substring(path.lastIndexOf('/') + 1);

  // ---- 浏览子目录模式 ----
  if (browsePath) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setBrowsePath(null)} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>选择文件夹</Text>
            <Text style={styles.headerPath} numberOfLines={1}>
              {browsePath.replace(STORAGE_ROOT, '📱')}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* 选择当前目录 */}
        <TouchableOpacity
          style={[styles.selectCurrent, selectedDirs.has(browsePath) && styles.selectedRow]}
          onPress={() => toggleDir(browsePath)}>
          <Icon
            name={selectedDirs.has(browsePath) ? 'checkbox' : 'square-outline'}
            size={22}
            color={selectedDirs.has(browsePath) ? COLORS.accent : COLORS.textMuted}
          />
          <Text style={styles.selectCurrentTxt}>选择此目录</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={subDirs}
            keyExtractor={item => item}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.browseRow}>
                <TouchableOpacity
                  onPress={() => toggleDir(item)}
                  style={[styles.checkArea, selectedDirs.has(item) && styles.selectedRow]}>
                  <Icon
                    name={selectedDirs.has(item) ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={selectedDirs.has(item) ? COLORS.accent : COLORS.textMuted}
                  />
                  <Icon name="folder" size={20} color={COLORS.secondary} style={{ marginLeft: 10 }} />
                  <Text style={styles.browseDirName} numberOfLines={1}>{dirName(item)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setBrowsePath(item)} style={styles.enterBtn}>
                  <Icon name="chevron-forward" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyTxt}>此目录下没有子文件夹</Text>
            }
          />
        )}

        {/* 底部栏 */}
        <View style={styles.bottomBar}>
          <Text style={styles.selectedCount}>已选 {selectedDirs.size} 个目录</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmTxt}>开始扫描</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- 常用目录选择模式（整体可滚动） ----
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Icon name="close" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitleCenter}>选择扫描目录</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 快速扫描全部 */}
        <TouchableOpacity style={styles.scanAllBtn} onPress={handleScanAll} activeOpacity={0.7}>
          <Icon name="scan" size={20} color={COLORS.bg} />
          <Text style={styles.scanAllTxt}>扫描全部常用目录</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>常用目录</Text>

        {COMMON_DIRS.map(dir => (
          <TouchableOpacity
            key={dir.path}
            style={[styles.commonRow, selectedDirs.has(dir.path) && styles.selectedRow]}
            onPress={() => toggleDir(dir.path)}>
            <Icon
              name={selectedDirs.has(dir.path) ? 'checkbox' : 'square-outline'}
              size={22}
              color={selectedDirs.has(dir.path) ? COLORS.accent : COLORS.textMuted}
            />
            <Icon name="folder" size={20} color={COLORS.secondary} style={{ marginLeft: 12 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.commonName}>{dir.name}</Text>
              <Text style={styles.commonPath}>{dir.path.replace(STORAGE_ROOT + '/', '')}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* 自定义浏览 */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>自定义</Text>
        <TouchableOpacity
          style={styles.browseStartBtn}
          onPress={() => setBrowsePath(STORAGE_ROOT)}>
          <Icon name="folder-open-outline" size={20} color={COLORS.accent} />
          <Text style={styles.browseStartTxt}>浏览文件夹...</Text>
        </TouchableOpacity>

        {/* 已选自定义目录列表 */}
        {Array.from(selectedDirs)
          .filter(d => !COMMON_DIRS.some(c => c.path === d))
          .map(dir => (
            <View key={dir} style={[styles.commonRow, styles.selectedRow]}>
              <Icon name="checkbox" size={22} color={COLORS.accent} />
              <Icon name="folder" size={20} color={COLORS.secondary} style={{ marginLeft: 12 }} />
              <Text style={[styles.commonName, { flex: 1, marginLeft: 10 }]} numberOfLines={1}>
                {dir.replace(STORAGE_ROOT + '/', '')}
              </Text>
              <TouchableOpacity onPress={() => toggleDir(dir)} hitSlop={8}>
                <Icon name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

        {/* 底部占位，防止被底栏遮挡 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部栏 */}
      <View style={styles.bottomBar}>
        <Text style={styles.selectedCount}>已选 {selectedDirs.size} 个目录</Text>
        <TouchableOpacity
          style={[styles.confirmBtn, selectedDirs.size === 0 && styles.confirmDisabled]}
          onPress={handleConfirm}
          disabled={selectedDirs.size === 0}>
          <Text style={styles.confirmTxt}>开始扫描</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, marginLeft: 8 },
  headerTitleCenter: {
    flex: 1, fontSize: SIZES.xl, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },
  headerTitle: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  headerPath: { fontSize: SIZES.xs, color: COLORS.textMuted, marginTop: 2 },

  // 主体滚动区
  scrollBody: { flex: 1 },
  scrollContent: { paddingHorizontal: 0 },

  // 扫描全部按钮
  scanAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginTop: 8, marginBottom: 16,
    paddingVertical: 14, borderRadius: SIZES.radius,
    backgroundColor: COLORS.accent, gap: 8,
  },
  scanAllTxt: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.bg },

  sectionLabel: {
    fontSize: SIZES.xs, color: COLORS.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1.5,
    marginHorizontal: 20, marginBottom: 8,
  },

  // 常用目录行
  commonRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  selectedRow: { backgroundColor: COLORS.accentDim },
  commonName: { fontSize: SIZES.md, color: COLORS.textPrimary, fontWeight: '600' },
  commonPath: { fontSize: SIZES.xs, color: COLORS.textMuted, marginTop: 2 },

  // 自定义浏览入口
  browseStartBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, paddingVertical: 14, gap: 10,
  },
  browseStartTxt: { fontSize: SIZES.md, color: COLORS.accent, fontWeight: '600' },

  // 浏览模式
  browseRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  checkArea: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  browseDirName: { flex: 1, fontSize: SIZES.md, color: COLORS.textPrimary, marginLeft: 10 },
  enterBtn: { paddingHorizontal: 16, paddingVertical: 14 },
  selectCurrent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.bgCard, gap: 10, marginBottom: 8,
  },
  selectCurrentTxt: { fontSize: SIZES.md, color: COLORS.textPrimary, fontWeight: '600' },
  emptyTxt: { fontSize: SIZES.md, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },

  // 底部栏
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 34,
    backgroundColor: COLORS.bgElevated,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  selectedCount: { fontSize: SIZES.md, color: COLORS.textSecondary },
  confirmBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 24, backgroundColor: COLORS.accent,
  },
  confirmDisabled: { opacity: 0.4 },
  confirmTxt: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.bg },
});

export default FolderPickerScreen;
