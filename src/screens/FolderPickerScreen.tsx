// src/screens/FolderPickerScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { IOS_HIDDEN_DIR_NAMES } from '../utils/defaultDirs';
import { SUPPORTED_FORMATS } from '../utils/theme';
import RNFS from 'react-native-fs';

const STORAGE_ROOT =
  Platform.OS === 'android' ? RNFS.ExternalStorageDirectoryPath : RNFS.DocumentDirectoryPath;

const COMMON_DIRS =
  Platform.OS === 'android'
    ? [{ name: 'music', path: `${STORAGE_ROOT}/Music` }]
    : [{ name: 'music', path: `${RNFS.DocumentDirectoryPath}/music` }];

export { STORAGE_ROOT, COMMON_DIRS };

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface Props {
  onConfirm: (dirs: string[]) => void;
  onCancel: () => void;
  initialSelected?: string[];
  /** iOS only: callback when user selects files/dirs + iPod option */
  onIOSImport?: (opts: { includeIPod: boolean; localDirs: string[]; localFiles: string[] }) => void;
}

async function listDirEntries(dirPath: string, showFiles: boolean): Promise<DirEntry[]> {
  const entries: DirEntry[] = [];
  try {
    if (!(await RNFS.exists(dirPath))) {
      return entries;
    }
    const items = await RNFS.readDir(dirPath);
    for (const item of items) {
      if (item.name.startsWith('.')) {
        continue;
      }
      if (item.isDirectory()) {
        if (Platform.OS === 'ios' && IOS_HIDDEN_DIR_NAMES.includes(item.name)) {
          continue;
        }
        entries.push({ name: item.name, path: item.path, isDir: true });
      } else if (showFiles && item.isFile()) {
        const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          entries.push({ name: item.name, path: item.path, isDir: false });
        }
      }
    }
  } catch {}
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return entries;
}

const FolderPickerScreen: React.FC<Props> = ({
  onConfirm,
  onCancel,
  initialSelected = [],
  onIOSImport,
}) => {
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const isIOS = Platform.OS === 'ios';

  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(new Set(initialSelected));
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [browseEntries, setBrowseEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeIPod, setIncludeIPod] = useState(isIOS);
  const [iosDocEntries, setIosDocEntries] = useState<DirEntry[]>([]);
  const [iosDocLoading, setIosDocLoading] = useState(isIOS);

  useEffect(() => {
    if (!isIOS) {
      return;
    }
    setIosDocLoading(true);
    listDirEntries(RNFS.DocumentDirectoryPath, true).then(entries => {
      setIosDocEntries(entries);
      setIosDocLoading(false);
    });
  }, [isIOS]);

  useEffect(() => {
    if (!browsePath) {
      setBrowseEntries([]);
      return;
    }
    setLoading(true);
    listDirEntries(browsePath, isIOS).then(entries => {
      setBrowseEntries(entries);
      setLoading(false);
    });
  }, [browsePath, isIOS]);

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

  const toggleFile = useCallback((file: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  }, []);

  const selectAllDocEntries = useCallback(() => {
    const dirs = iosDocEntries.filter(e => e.isDir).map(e => e.path);
    const files = iosDocEntries.filter(e => !e.isDir).map(e => e.path);
    const allDirsSelected = dirs.every(d => selectedDirs.has(d));
    const allFilesSelected = files.every(f => selectedFiles.has(f));
    const allSelected = allDirsSelected && allFilesSelected;
    if (allSelected) {
      setSelectedDirs(prev => {
        const next = new Set(prev);
        dirs.forEach(d => next.delete(d));
        return next;
      });
      setSelectedFiles(prev => {
        const next = new Set(prev);
        files.forEach(f => next.delete(f));
        return next;
      });
    } else {
      setSelectedDirs(prev => {
        const next = new Set(prev);
        dirs.forEach(d => next.add(d));
        return next;
      });
      setSelectedFiles(prev => {
        const next = new Set(prev);
        files.forEach(f => next.add(f));
        return next;
      });
    }
  }, [iosDocEntries, selectedDirs, selectedFiles]);

  const isAllDocSelected =
    iosDocEntries.length > 0 &&
    iosDocEntries.filter(e => e.isDir).every(e => selectedDirs.has(e.path)) &&
    iosDocEntries.filter(e => !e.isDir).every(e => selectedFiles.has(e.path));

  const selectAllFiles = useCallback(() => {
    const files = browseEntries.filter(e => !e.isDir).map(e => e.path);
    setSelectedFiles(prev => {
      const next = new Set(prev);
      const allSelected = files.every(f => next.has(f));
      if (allSelected) {
        files.forEach(f => next.delete(f));
      } else {
        files.forEach(f => next.add(f));
      }
      return next;
    });
  }, [browseEntries]);

  const totalSelected = selectedDirs.size + selectedFiles.size + (isIOS && includeIPod ? 1 : 0);

  const handleConfirm = () => {
    if (isIOS && onIOSImport) {
      if (!includeIPod && selectedDirs.size === 0 && selectedFiles.size === 0) {
        Alert.alert(
          t('folderPicker.alerts.selectSourceTitle'),
          t('folderPicker.alerts.selectSourceMessage'),
        );
        return;
      }
      onIOSImport({
        includeIPod,
        localDirs: Array.from(selectedDirs),
        localFiles: Array.from(selectedFiles),
      });
      return;
    }

    const dirs = Array.from(selectedDirs);
    if (dirs.length === 0) {
      Alert.alert(
        t('folderPicker.alerts.selectDirTitle'),
        t('folderPicker.alerts.selectDirMessage'),
      );
      return;
    }
    onConfirm(dirs);
  };

  const handleScanAll = () => {
    if (isIOS && onIOSImport) {
      onIOSImport({ includeIPod: true, localDirs: [RNFS.DocumentDirectoryPath], localFiles: [] });
      return;
    }
    onConfirm(COMMON_DIRS.map(d => d.path));
  };

  const dirName = (path: string) => path.substring(path.lastIndexOf('/') + 1);
  const navigateUp = () => {
    if (!browsePath) {
      return;
    }
    const parent = browsePath.substring(0, browsePath.lastIndexOf('/'));
    // If parent is the storage root or above, go back to the main screen directly
    if (parent.length <= STORAGE_ROOT.length) {
      setBrowsePath(null);
    } else {
      setBrowsePath(parent);
    }
  };

  // ---- 浏览子目录模式 ----
  if (browsePath) {
    const fileEntries = browseEntries.filter(e => !e.isDir);

    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={navigateUp} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text
              style={{
                fontSize: sizes.xl,
                fontWeight: '700',
                color: colors.textPrimary,
              }}>
              {t('folderPicker.selectFolder')}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <TouchableOpacity
          style={[
            styles.selectCurrent,
            { backgroundColor: colors.bgCard },
            selectedDirs.has(browsePath) && { backgroundColor: colors.accentDim },
            !loading && browseEntries.length === 0 && { opacity: 0.4 },
          ]}
          onPress={() => toggleDir(browsePath)}
          disabled={!loading && browseEntries.length === 0}>
          <Icon
            name={selectedDirs.has(browsePath) ? 'checkbox' : 'square-outline'}
            size={22}
            color={selectedDirs.has(browsePath) ? colors.accent : colors.textMuted}
          />
          <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
            {t('folderPicker.selectCurrent')}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={browseEntries}
            keyExtractor={item => item.path}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) =>
              item.isDir ? (
                <View style={[styles.browseRow, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={() => toggleDir(item.path)}
                    style={[
                      styles.checkArea,
                      selectedDirs.has(item.path) && { backgroundColor: colors.accentDim },
                    ]}>
                    <Icon
                      name={selectedDirs.has(item.path) ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={selectedDirs.has(item.path) ? colors.accent : colors.textMuted}
                    />
                    <Icon
                      name="folder"
                      size={20}
                      color={colors.secondary}
                      style={{ marginLeft: 10 }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: sizes.md,
                        color: colors.textPrimary,
                        marginLeft: 10,
                      }}
                      numberOfLines={1}>
                      {dirName(item.path)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setBrowsePath(item.path)}
                    style={styles.enterBtn}>
                    <Icon name="chevron-forward" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.fileRow,
                    { borderBottomColor: colors.border },
                    selectedFiles.has(item.path) && { backgroundColor: colors.accentDim },
                  ]}
                  onPress={() => toggleFile(item.path)}>
                  <Icon
                    name={selectedFiles.has(item.path) ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={selectedFiles.has(item.path) ? colors.accent : colors.textMuted}
                  />
                  <Icon
                    name="musical-note"
                    size={18}
                    color={colors.accent}
                    style={{ marginLeft: 10 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: sizes.sm,
                      color: colors.textPrimary,
                      marginLeft: 10,
                    }}
                    numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )
            }
            ListHeaderComponent={
              isIOS && fileEntries.length > 0 ? (
                <TouchableOpacity
                  style={[styles.selectAllRow, { borderBottomColor: colors.border }]}
                  onPress={selectAllFiles}>
                  <Icon name="checkmark-done" size={20} color={colors.accent} />
                  <Text
                    style={{
                      fontSize: sizes.sm,
                      color: colors.accent,
                      fontWeight: '600',
                      marginLeft: 8,
                    }}>
                    {fileEntries.every(e => selectedFiles.has(e.path))
                      ? t('folderPicker.selectAllFiles.deselectAll')
                      : t('folderPicker.selectAllFiles.selectAll')}{' '}
                    ({fileEntries.length})
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <Text
                style={{
                  fontSize: sizes.md,
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: 40,
                }}>
                {isIOS
                  ? t('folderPicker.emptyMessage.iosFolders')
                  : t('folderPicker.emptyMessage.androidFolders')}
              </Text>
            }
          />
        )}

        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.bgElevated, borderTopColor: colors.border },
          ]}>
          <Text style={{ fontSize: sizes.md, color: colors.textSecondary }}>
            {t('folderPicker.buttons.selectedDirs', { count: selectedDirs.size })}
            {isIOS && selectedFiles.size > 0
              ? `, ${selectedFiles.size} ${t('folderPicker.buttons.filesFormat')}`
              : ''}
          </Text>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
            onPress={handleConfirm}>
            <Text style={{ fontSize: sizes.md, fontWeight: '700', color: colors.bg }}>
              {t('folderPicker.buttons.iosStart')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- 常用目录选择模式 ----
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            fontSize: sizes.xl,
            fontWeight: '700',
            color: colors.textPrimary,
            textAlign: 'center',
          }}>
          {isIOS
            ? t('folderPicker.headers.iosSelectSource')
            : t('folderPicker.headers.androidSelectDirectory')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.scanAllBtn, { backgroundColor: colors.accent }]}
          onPress={handleScanAll}
          activeOpacity={0.7}>
          <Icon name={isIOS ? 'cloud-download' : 'scan'} size={20} color={colors.bg} />
          <Text style={{ fontSize: sizes.lg, fontWeight: '700', color: colors.bg }}>
            {isIOS
              ? t('folderPicker.buttons.iosImportAll')
              : t('folderPicker.buttons.androidScanAll')}
          </Text>
        </TouchableOpacity>

        {isIOS && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('folderPicker.sections.library')}
            </Text>
            <TouchableOpacity
              style={[
                styles.commonRow,
                { borderBottomColor: colors.border },
                includeIPod && { backgroundColor: colors.accentDim },
              ]}
              onPress={() => setIncludeIPod(!includeIPod)}>
              <Icon
                name={includeIPod ? 'checkbox' : 'square-outline'}
                size={22}
                color={includeIPod ? colors.accent : colors.textMuted}
              />
              <Icon
                name="musical-notes"
                size={20}
                color={colors.secondary}
                style={{ marginLeft: 12 }}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
                  {t('folderPicker.itunesSource')}
                </Text>
                <Text style={{ fontSize: sizes.xs, color: colors.textMuted, marginTop: 2 }}>
                  {t('folderPicker.itunesHint')}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {isIOS ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 24,
                marginHorizontal: 20,
                marginBottom: 8,
              }}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.textMuted, marginTop: 0, marginHorizontal: 0, marginBottom: 0 },
                ]}>
                {t('folderPicker.sections.documents')}
              </Text>
              {iosDocEntries.length > 0 && (
                <TouchableOpacity onPress={selectAllDocEntries} hitSlop={8}>
                  <Text style={{ fontSize: sizes.sm, color: colors.accent, fontWeight: '600' }}>
                    {isAllDocSelected
                      ? t('folderPicker.selectAll.deselectAll')
                      : t('folderPicker.selectAll.selectAll')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {iosDocLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.accent}
                style={{ marginTop: 16, marginBottom: 16 }}
              />
            ) : (
              <>
                {iosDocEntries
                  .filter(e => e.isDir)
                  .map(entry => (
                    <View
                      key={entry.path}
                      style={[styles.browseRow, { borderBottomColor: colors.border }]}>
                      <TouchableOpacity
                        onPress={() => toggleDir(entry.path)}
                        style={[
                          styles.checkArea,
                          selectedDirs.has(entry.path) && { backgroundColor: colors.accentDim },
                        ]}>
                        <Icon
                          name={selectedDirs.has(entry.path) ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={selectedDirs.has(entry.path) ? colors.accent : colors.textMuted}
                        />
                        <Icon
                          name="folder"
                          size={20}
                          color={colors.secondary}
                          style={{ marginLeft: 12 }}
                        />
                        <Text
                          style={{
                            flex: 1,
                            fontSize: sizes.md,
                            color: colors.textPrimary,
                            fontWeight: '600',
                            marginLeft: 10,
                          }}
                          numberOfLines={1}>
                          {entry.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setBrowsePath(entry.path)}
                        style={styles.enterBtn}>
                        <Icon name="chevron-forward" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                {iosDocEntries
                  .filter(e => !e.isDir)
                  .map(entry => (
                    <TouchableOpacity
                      key={entry.path}
                      style={[
                        styles.fileRow,
                        { borderBottomColor: colors.border },
                        selectedFiles.has(entry.path) && { backgroundColor: colors.accentDim },
                      ]}
                      onPress={() => toggleFile(entry.path)}>
                      <Icon
                        name={selectedFiles.has(entry.path) ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={selectedFiles.has(entry.path) ? colors.accent : colors.textMuted}
                      />
                      <Icon
                        name="musical-note"
                        size={18}
                        color={colors.accent}
                        style={{ marginLeft: 10 }}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: sizes.sm,
                          color: colors.textPrimary,
                          marginLeft: 10,
                        }}
                        numberOfLines={1}>
                        {entry.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                {iosDocEntries.length === 0 && (
                  <Text
                    style={{
                      fontSize: sizes.sm,
                      color: colors.textMuted,
                      textAlign: 'center',
                      paddingVertical: 16,
                    }}>
                    {t('folderPicker.emptyMessage.documentsFolder')}
                  </Text>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('folderPicker.sections.common')}
            </Text>
            {COMMON_DIRS.map(dir => (
              <TouchableOpacity
                key={dir.path}
                style={[
                  styles.commonRow,
                  { borderBottomColor: colors.border },
                  selectedDirs.has(dir.path) && { backgroundColor: colors.accentDim },
                ]}
                onPress={() => toggleDir(dir.path)}>
                <Icon
                  name={selectedDirs.has(dir.path) ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={selectedDirs.has(dir.path) ? colors.accent : colors.textMuted}
                />
                <Icon name="folder" size={20} color={colors.secondary} style={{ marginLeft: 12 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }}>
                    {(dir as any).nameKey ? t((dir as any).nameKey) : dir.name}
                  </Text>
                  <Text style={{ fontSize: sizes.xs, color: colors.textMuted, marginTop: 2 }}>
                    {dir.path.replace(STORAGE_ROOT + '/', '')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              {t('folderPicker.sections.custom')}
            </Text>
            <TouchableOpacity
              style={styles.browseStartBtn}
              onPress={() => setBrowsePath(STORAGE_ROOT)}>
              <Icon name="folder-open-outline" size={20} color={colors.accent} />
              <Text style={{ fontSize: sizes.md, color: colors.accent, fontWeight: '600' }}>
                {t('folderPicker.browse')}
              </Text>
            </TouchableOpacity>
            {Array.from(selectedDirs)
              .filter(d => !COMMON_DIRS.some(c => c.path === d))
              .map(dir => (
                <View
                  key={dir}
                  style={[
                    styles.commonRow,
                    { borderBottomColor: colors.border, backgroundColor: colors.accentDim },
                  ]}>
                  <Icon name="checkbox" size={22} color={colors.accent} />
                  <Icon
                    name="folder"
                    size={20}
                    color={colors.secondary}
                    style={{ marginLeft: 12 }}
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
          </>
        )}

        {selectedFiles.size > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              {t('folderPicker.sections.selectedFiles')}
            </Text>
            <View
              style={[
                styles.commonRow,
                { borderBottomColor: colors.border, backgroundColor: colors.accentDim },
              ]}>
              <Icon name="musical-note" size={20} color={colors.accent} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: sizes.md,
                  color: colors.textPrimary,
                  fontWeight: '600',
                }}>
                {selectedFiles.size} {t('folderPicker.buttons.filesFormat')}
              </Text>
              <TouchableOpacity onPress={() => setSelectedFiles(new Set())} hitSlop={8}>
                <Icon name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.bgElevated, borderTopColor: colors.border },
        ]}>
        <Text style={{ fontSize: sizes.md, color: colors.textSecondary }}>
          {isIOS
            ? t('folderPicker.buttons.selectedItems', { count: totalSelected })
            : t('folderPicker.buttons.selectedDirs', { count: selectedDirs.size })}
        </Text>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            { backgroundColor: colors.accent },
            totalSelected === 0 && !isIOS && { opacity: 0.4 },
          ]}
          onPress={handleConfirm}
          disabled={!isIOS && selectedDirs.size === 0}>
          <Text style={{ fontSize: sizes.md, fontWeight: '700', color: colors.bg }}>
            {isIOS ? t('folderPicker.buttons.iosStart') : t('folderPicker.buttons.androidStart')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  headerCenter: { flex: 1, marginLeft: 8 },
  scrollBody: { flex: 1 },
  scrollContent: { paddingHorizontal: 0 },
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
  browseRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  checkArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  enterBtn: { paddingHorizontal: 16, paddingVertical: 14 },
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
  confirmBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
});

export default FolderPickerScreen;
