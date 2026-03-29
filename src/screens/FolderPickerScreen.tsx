// src/screens/FolderPickerScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { useAppSelector } from '../store';
import { IOS_HIDDEN_DIR_NAMES, getDefaultMusicDir } from '../utils/defaultDirs';
import { SUPPORTED_FORMATS } from '../utils/theme';
import RNFS from 'react-native-fs';

const STORAGE_ROOT =
  Platform.OS === 'android' ? RNFS.ExternalStorageDirectoryPath : RNFS.DocumentDirectoryPath;

const COMMON_DIRS =
  Platform.OS === 'android'
    ? [{ name: 'music', path: getDefaultMusicDir() }]
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
  const { isScanning, scanProgress } = useAppSelector(s => s.music);

  const [selectedDirs, setSelectedDirs] = useState<Set<string>>(new Set(initialSelected));
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [pendingBrowsePath, setPendingBrowsePath] = useState<string | null>(null);
  const [browseEntries, setBrowseEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [browseTransitioning, setBrowseTransitioning] = useState(false);
  const [iosDocEntries, setIosDocEntries] = useState<DirEntry[]>([]);
  const [iosDocLoading, setIosDocLoading] = useState(isIOS);

  // Track scanning lifecycle: wait for isScanning to become true then false
  const [scanTriggered, setScanTriggered] = useState(false);
  const scanWasActive = useRef(false);

  useEffect(() => {
    if (scanTriggered && isScanning) {
      scanWasActive.current = true;
    }
    if (scanTriggered && scanWasActive.current && !isScanning) {
      // Scanning started and finished — close the picker
      setScanTriggered(false);
      scanWasActive.current = false;
      onCancel();
    }
  }, [scanTriggered, isScanning, onCancel]);

  useEffect(() => {
    if (!isIOS) {
      return;
    }
    setIosDocLoading(true);
    listDirEntries(RNFS.DocumentDirectoryPath, true).then(entries => {
      // iOS local source only shows the music directory under Documents
      const musicDir = entries.find(
        e => e.isDir && e.name.toLowerCase() === 'music',
      );
      setIosDocEntries(musicDir ? [musicDir] : []);
      setIosDocLoading(false);
    });
  }, [isIOS]);

  useEffect(() => {
    if (!browsePath) {
      setBrowseEntries([]);
      setPendingBrowsePath(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listDirEntries(browsePath, isIOS).then(entries => {
      if (cancelled) {
        return;
      }
      setBrowseEntries(entries);
      setLoading(false);
      setPendingBrowsePath(null);
      setBrowseTransitioning(false);
    });
    return () => {
      cancelled = true;
    };
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

  const selectAllBrowseEntries = useCallback(() => {
    const dirs = browseEntries.filter(e => e.isDir).map(e => e.path);
    const files = browseEntries.filter(e => !e.isDir).map(e => e.path);
    const allDirsSelected = dirs.every(d => selectedDirs.has(d));
    const allFilesSelected = files.every(f => selectedFiles.has(f));
    const allSelected = allDirsSelected && allFilesSelected;

    setSelectedDirs(prev => {
      const next = new Set(prev);
      if (allSelected) {
        dirs.forEach(d => next.delete(d));
      } else {
        dirs.forEach(d => next.add(d));
      }
      return next;
    });

    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (allSelected) {
        files.forEach(f => next.delete(f));
      } else {
        files.forEach(f => next.add(f));
      }
      return next;
    });
  }, [browseEntries, selectedDirs, selectedFiles]);

  const totalSelected = selectedDirs.size + selectedFiles.size;

  const handleConfirm = () => {
    if (isIOS && onIOSImport) {
      if (selectedDirs.size === 0 && selectedFiles.size === 0) {
        Alert.alert(
          t('folderPicker.alerts.selectSourceTitle'),
          t('folderPicker.alerts.selectSourceMessage'),
        );
        return;
      }
      setScanTriggered(true);
      onIOSImport({
        includeIPod: false,
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
    setScanTriggered(true);
    onConfirm(dirs);
  };

  const handleScanAll = () => {
    setScanTriggered(true);
    if (isIOS && onIOSImport) {
      onIOSImport({ includeIPod: true, localDirs: [], localFiles: [] });
      return;
    }
    onConfirm(COMMON_DIRS.map(d => d.path));
  };

  const dirName = (path: string) => path.substring(path.lastIndexOf('/') + 1);
  const openBrowsePath = useCallback((path: string) => {
    // Clear previous list first to avoid one-frame ghosting during directory switch.
    setBrowseEntries([]);
    setLoading(true);
    setBrowseTransitioning(true);
    setPendingBrowsePath(path);
    setBrowsePath(path);
  }, []);

  const currentBrowsePath = browsePath ?? pendingBrowsePath;

  const navigateUp = () => {
    if (!currentBrowsePath) {
      return;
    }
    // On common music root, back should return to source selection page directly.
    if (COMMON_DIRS.some(d => d.path === currentBrowsePath)) {
      setPendingBrowsePath(null);
      setBrowseTransitioning(false);
      setBrowsePath(null);
      return;
    }
    // If already at storage root, go back to main screen
    if (currentBrowsePath === STORAGE_ROOT) {
      setPendingBrowsePath(null);
      setBrowseTransitioning(false);
      setBrowsePath(null);
      return;
    }
    const parent = currentBrowsePath.substring(0, currentBrowsePath.lastIndexOf('/'));
    if (parent.length < STORAGE_ROOT.length) {
      setPendingBrowsePath(null);
      setBrowseTransitioning(false);
      setBrowsePath(null);
    } else {
      openBrowsePath(parent);
    }
  };

  const isAllBrowseSelected =
    browseEntries.length > 0 &&
    browseEntries.filter(e => e.isDir).every(e => selectedDirs.has(e.path)) &&
    browseEntries.filter(e => !e.isDir).every(e => selectedFiles.has(e.path));

  // ---- Scanning in progress overlay ----
  if (scanTriggered && isScanning) {
    const p = scanProgress;
    const pct =
      p && p.total > 0 && p.phase === 'parsing'
        ? Math.round((p.current / p.total) * 100)
        : 0;

    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <View style={styles.backBtn}>
            <View style={{ width: 24 }} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: sizes.xl,
              fontWeight: '700',
              color: colors.textPrimary,
              textAlign: 'center',
            }}>
            {t('folderPicker.scanning')}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            style={{
              fontSize: sizes.xl,
              color: colors.textPrimary,
              fontWeight: '600',
              marginTop: 20,
            }}>
            {p?.phase === 'scanning'
              ? isIOS
                ? t('allSongs.importing.readingLibrary')
                : t('allSongs.importing.scanning')
              : t('allSongs.importing.parsing')}
          </Text>
          <View style={styles.progressWrap}>
            <View style={[styles.progressBg, { backgroundColor: colors.bgElevated }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.accent, width: `${pct}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.accent }]}>{pct}%</Text>
          </View>
          {p?.phase === 'parsing' && p.total > 0 && (
            <Text
              style={{
                fontSize: sizes.sm,
                color: colors.textMuted,
                marginTop: 8,
                fontVariant: ['tabular-nums'],
              }}>
              {p.current} / {p.total}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ---- 浏览子目录模式 ----
  if (currentBrowsePath) {

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

        {browseTransitioning && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}

        {!browseTransitioning && loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : !browseTransitioning ? (
          <FlatList
            key={currentBrowsePath}
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
                    onPress={() => openBrowsePath(item.path)}
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
              browseEntries.length > 0 ? (
                <TouchableOpacity
                  style={[styles.selectAllRow, { borderBottomColor: colors.border }]}
                  onPress={selectAllBrowseEntries}>
                  <Icon name="checkmark-done" size={20} color={colors.accent} />
                  <Text
                    style={{
                      fontSize: sizes.sm,
                      color: colors.accent,
                      fontWeight: '600',
                      marginLeft: 8,
                    }}>
                    {isAllBrowseSelected
                      ? t('folderPicker.selectAll.deselectAll')
                      : t('folderPicker.selectAll.selectAll')}{' '}
                    ({browseEntries.length})
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
        ) : null}

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
                          onPress={() => openBrowsePath(entry.path)}
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
              <View
                key={dir.path}
                style={[
                  styles.browseRow,
                  { borderBottomColor: colors.border },
                ]}>
                <TouchableOpacity
                  onPress={() => toggleDir(dir.path)}
                  style={[
                    styles.checkArea,
                    selectedDirs.has(dir.path) && { backgroundColor: colors.accentDim },
                  ]}>
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
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openBrowsePath(dir.path)}
                  style={styles.enterBtn}>
                  <Icon name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              {t('folderPicker.sections.custom')}
            </Text>
            <TouchableOpacity
              style={styles.browseStartBtn}
              onPress={() => openBrowsePath(STORAGE_ROOT)}>
              <Icon name="folder-open-outline" size={20} color={colors.accent} />
              <Text style={{ fontSize: sizes.md, color: colors.accent, fontWeight: '600' }}>
                {t('folderPicker.browse')}
              </Text>
            </TouchableOpacity>
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
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    width: '80%',
  },
  progressBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});

export default FolderPickerScreen;
