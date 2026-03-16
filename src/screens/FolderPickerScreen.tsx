// src/screens/FolderPickerScreen.tsx
import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {listSubDirectories} from '../utils/scanner';
import {useTheme} from '../contexts/ThemeContext';
import RNFS from 'react-native-fs';
import {Platform} from 'react-native';

const STORAGE_ROOT =
  Platform.OS === 'android'
    ? RNFS.ExternalStorageDirectoryPath
    : RNFS.DocumentDirectoryPath;

const COMMON_DIRS =
  Platform.OS === 'android'
    ? [
        {name: 'Music', path: `${STORAGE_ROOT}/Music`},
        {name: 'Download', path: `${STORAGE_ROOT}/Download`},
        {name: 'Documents', path: `${STORAGE_ROOT}/Documents`},
        {name: '网易云音乐', path: `${STORAGE_ROOT}/netease/cloudmusic/Music`},
        {name: 'QQ音乐', path: `${STORAGE_ROOT}/qqmusic/song`},
        {name: '酷狗音乐', path: `${STORAGE_ROOT}/kugou/download`},
      ]
    : [
        {name: 'App Documents', path: RNFS.DocumentDirectoryPath},
        {name: 'App Library', path: RNFS.LibraryDirectoryPath},
        {name: 'App Cache', path: RNFS.CachesDirectoryPath},
      ];

export {STORAGE_ROOT, COMMON_DIRS};

interface Props {
  onConfirm: (dirs: string[]) => void;
  onCancel: () => void;
  initialSelected?: string[];
}

const FolderPickerScreen: React.FC<Props> = ({
  onConfirm,
  onCancel,
  initialSelected = [],
}) => {
  const {colors, sizes} = useTheme();
  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(
    new Set(initialSelected),
  );
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [subDirs, setSubDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!browsePath) {
      return;
    }
    setLoading(true);
    listSubDirectories(browsePath).then(dirs => {
      setSubDirs(dirs);
      setLoading(false);
    });
  }, [browsePath]);

  const toggleDir = useCallback((dir: string) => {
    setSelectedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
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
      <View style={[styles.root, {backgroundColor: colors.bg}]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setBrowsePath(null)}
            style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text
              style={{
                fontSize: sizes.xl,
                fontWeight: '700',
                color: colors.textPrimary,
              }}>
              选择文件夹
            </Text>
            <Text
              style={{
                fontSize: sizes.xs,
                color: colors.textMuted,
                marginTop: 2,
              }}
              numberOfLines={1}>
              {browsePath.replace(STORAGE_ROOT, '📱')}
            </Text>
          </View>
          <View style={{width: 40}} />
        </View>

        <TouchableOpacity
          style={[
            styles.selectCurrent,
            {backgroundColor: colors.bgCard},
            selectedDirs.has(browsePath) && {backgroundColor: colors.accentDim},
          ]}
          onPress={() => toggleDir(browsePath)}>
          <Icon
            name={selectedDirs.has(browsePath) ? 'checkbox' : 'square-outline'}
            size={22}
            color={
              selectedDirs.has(browsePath) ? colors.accent : colors.textMuted
            }
          />
          <Text
            style={{
              fontSize: sizes.md,
              color: colors.textPrimary,
              fontWeight: '600',
            }}>
            选择此目录
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.accent}
            style={{marginTop: 40}}
          />
        ) : (
          <FlatList
            data={subDirs}
            keyExtractor={item => item}
            contentContainerStyle={{paddingBottom: 100}}
            renderItem={({item}) => (
              <View
                style={[styles.browseRow, {borderBottomColor: colors.border}]}>
                <TouchableOpacity
                  onPress={() => toggleDir(item)}
                  style={[
                    styles.checkArea,
                    selectedDirs.has(item) && {
                      backgroundColor: colors.accentDim,
                    },
                  ]}>
                  <Icon
                    name={
                      selectedDirs.has(item) ? 'checkbox' : 'square-outline'
                    }
                    size={20}
                    color={
                      selectedDirs.has(item) ? colors.accent : colors.textMuted
                    }
                  />
                  <Icon
                    name="folder"
                    size={20}
                    color={colors.secondary}
                    style={{marginLeft: 10}}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: sizes.md,
                      color: colors.textPrimary,
                      marginLeft: 10,
                    }}
                    numberOfLines={1}>
                    {dirName(item)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setBrowsePath(item)}
                  style={styles.enterBtn}>
                  <Icon
                    name="chevron-forward"
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text
                style={{
                  fontSize: sizes.md,
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: 40,
                }}>
                此目录下没有子文件夹
              </Text>
            }
          />
        )}

        <View
          style={[
            styles.bottomBar,
            {backgroundColor: colors.bgElevated, borderTopColor: colors.border},
          ]}>
          <Text style={{fontSize: sizes.md, color: colors.textSecondary}}>
            已选 {selectedDirs.size} 个目录
          </Text>
          <TouchableOpacity
            style={[styles.confirmBtn, {backgroundColor: colors.accent}]}
            onPress={handleConfirm}>
            <Text
              style={{fontSize: sizes.md, fontWeight: '700', color: colors.bg}}>
              开始扫描
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- 常用目录选择模式 ----
  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Icon name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: sizes.xl,
            fontWeight: '700',
            color: colors.textPrimary,
            textAlign: 'center',
          }}>
          选择扫描目录
        </Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.scanAllBtn, {backgroundColor: colors.accent}]}
          onPress={handleScanAll}
          activeOpacity={0.7}>
          <Icon name="scan" size={20} color={colors.bg} />
          <Text
            style={{fontSize: sizes.lg, fontWeight: '700', color: colors.bg}}>
            扫描全部常用目录
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, {color: colors.textMuted}]}>
          常用目录
        </Text>

        {COMMON_DIRS.map(dir => (
          <TouchableOpacity
            key={dir.path}
            style={[
              styles.commonRow,
              {borderBottomColor: colors.border},
              selectedDirs.has(dir.path) && {backgroundColor: colors.accentDim},
            ]}
            onPress={() => toggleDir(dir.path)}>
            <Icon
              name={selectedDirs.has(dir.path) ? 'checkbox' : 'square-outline'}
              size={22}
              color={
                selectedDirs.has(dir.path) ? colors.accent : colors.textMuted
              }
            />
            <Icon
              name="folder"
              size={20}
              color={colors.secondary}
              style={{marginLeft: 12}}
            />
            <View style={{flex: 1, marginLeft: 10}}>
              <Text
                style={{
                  fontSize: sizes.md,
                  color: colors.textPrimary,
                  fontWeight: '600',
                }}>
                {dir.name}
              </Text>
              <Text
                style={{
                  fontSize: sizes.xs,
                  color: colors.textMuted,
                  marginTop: 2,
                }}>
                {dir.path.replace(STORAGE_ROOT + '/', '')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text
          style={[
            styles.sectionLabel,
            {color: colors.textMuted, marginTop: 24},
          ]}>
          自定义
        </Text>
        <TouchableOpacity
          style={styles.browseStartBtn}
          onPress={() => setBrowsePath(STORAGE_ROOT)}>
          <Icon name="folder-open-outline" size={20} color={colors.accent} />
          <Text
            style={{
              fontSize: sizes.md,
              color: colors.accent,
              fontWeight: '600',
            }}>
            浏览文件夹...
          </Text>
        </TouchableOpacity>

        {Array.from(selectedDirs)
          .filter(d => !COMMON_DIRS.some(c => c.path === d))
          .map(dir => (
            <View
              key={dir}
              style={[
                styles.commonRow,
                {
                  borderBottomColor: colors.border,
                  backgroundColor: colors.accentDim,
                },
              ]}>
              <Icon name="checkbox" size={22} color={colors.accent} />
              <Icon
                name="folder"
                size={20}
                color={colors.secondary}
                style={{marginLeft: 12}}
              />
              <Text
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: sizes.md,
                  color: colors.textPrimary,
                  fontWeight: '600',
                }}
                numberOfLines={1}>
                {dir.replace(STORAGE_ROOT + '/', '')}
              </Text>
              <TouchableOpacity onPress={() => toggleDir(dir)} hitSlop={8}>
                <Icon name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

        <View style={{height: 100}} />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {backgroundColor: colors.bgElevated, borderTopColor: colors.border},
        ]}>
        <Text style={{fontSize: sizes.md, color: colors.textSecondary}}>
          已选 {selectedDirs.size} 个目录
        </Text>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            {backgroundColor: colors.accent},
            selectedDirs.size === 0 && {opacity: 0.4},
          ]}
          onPress={handleConfirm}
          disabled={selectedDirs.size === 0}>
          <Text
            style={{fontSize: sizes.md, fontWeight: '700', color: colors.bg}}>
            开始扫描
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backBtn: {padding: 8},
  headerCenter: {flex: 1, marginLeft: 8},
  scrollBody: {flex: 1},
  scrollContent: {paddingHorizontal: 0},
  scanAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  commonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  browseStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  browseRow: {flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1},
  checkArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  enterBtn: {paddingHorizontal: 16, paddingVertical: 14},
  selectCurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  confirmBtn: {paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24},
});

export default FolderPickerScreen;
