// src/screens/BrowseScreen.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RNFS from 'react-native-fs';
import {useTheme} from '../contexts/ThemeContext';
import {useTranslation} from 'react-i18next';
import {useAppSelector, useAppDispatch} from '../store';
import {playTrack} from '../store/musicSlice';
import {
  listFolderContents,
  getTracksInFolder,
  FolderItem,
  AudioFileItem,
} from '../utils/folderBrowser';
import TrackMenu from '../components/TrackMenu';
import {Track} from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ListItem =
  | {type: 'folder'; data: FolderItem}
  | {type: 'audio'; data: AudioFileItem};

const BrowseScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const {colors, sizes} = useTheme();
  const {t} = useTranslation();
  const {tracks, scanDirectories} = useAppSelector(s => s.music);

  const defaultRoot = useMemo(() => {
    if (scanDirectories.length === 1) return scanDirectories[0];
    if (Platform.OS === 'ios') return RNFS.DocumentDirectoryPath;
    return scanDirectories[0] ?? RNFS.ExternalStorageDirectoryPath;
  }, [scanDirectories]);

  const showRootList = scanDirectories.length > 1;

  const [currentPath, setCurrentPath] = useState<string | null>(
    showRootList ? null : defaultRoot,
  );
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (currentPath === null) return;
    let cancelled = false;
    setLoading(true);
    listFolderContents(currentPath)
      .then(result => {
        if (cancelled) return;
        setFolders(result.folders);
        setAudioFiles(result.audioFiles);
      })
      .catch(() => {
        if (cancelled) return;
        setFolders([]);
        setAudioFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  const navigateToFolder = useCallback(
    (path: string) => {
      setPathHistory(prev =>
        currentPath !== null ? [...prev, currentPath] : prev,
      );
      setCurrentPath(path);
    },
    [currentPath],
  );

  const navigateBack = useCallback(() => {
    if (pathHistory.length > 0) {
      const prev = pathHistory[pathHistory.length - 1];
      setPathHistory(h => h.slice(0, -1));
      setCurrentPath(prev);
    } else if (showRootList) {
      setCurrentPath(null);
    }
  }, [pathHistory, showRootList]);

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      if (index === -1) {
        // home
        if (showRootList) {
          setCurrentPath(null);
          setPathHistory([]);
        } else {
          setCurrentPath(defaultRoot);
          setPathHistory([]);
        }
        return;
      }
      const allPaths =
        currentPath !== null ? [...pathHistory, currentPath] : [...pathHistory];
      const targetPath = allPaths[index];
      if (targetPath) {
        setCurrentPath(targetPath);
        setPathHistory(allPaths.slice(0, index));
      }
    },
    [pathHistory, currentPath, showRootList, defaultRoot],
  );

  const breadcrumbSegments = useMemo(() => {
    const allPaths =
      currentPath !== null ? [...pathHistory, currentPath] : [...pathHistory];
    return allPaths.map(p => {
      const parts = p.split('/');
      return parts[parts.length - 1] || p;
    });
  }, [pathHistory, currentPath]);

  const tracksInFolder = useMemo(() => {
    if (currentPath === null) return [];
    return getTracksInFolder(currentPath, tracks);
  }, [currentPath, tracks]);

  const findTrackForFile = useCallback(
    (filePath: string): Track | undefined => {
      return tracks.find(
        tr => tr.filePath === filePath || tr.url === 'file://' + filePath,
      );
    },
    [tracks],
  );

  const handlePlayAll = useCallback(() => {
    if (tracksInFolder.length === 0) return;
    dispatch(playTrack({track: tracksInFolder[0], queue: tracksInFolder}));
  }, [dispatch, tracksInFolder]);

  const handleAudioPress = useCallback(
    (file: AudioFileItem) => {
      const track = findTrackForFile(file.path);
      if (track) {
        dispatch(playTrack({track, queue: tracksInFolder}));
      } else {
        Alert.alert(t('common.hint'), t('browse.notImported'));
      }
    },
    [dispatch, findTrackForFile, tracksInFolder, t],
  );

  const handleAudioLongPress = useCallback(
    (file: AudioFileItem) => {
      const track = findTrackForFile(file.path);
      if (track) {
        setMenuTrack(track);
        setShowMenu(true);
      }
    },
    [findTrackForFile],
  );

  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    for (const f of folders) items.push({type: 'folder', data: f});
    for (const a of audioFiles) items.push({type: 'audio', data: a});
    return items;
  }, [folders, audioFiles]);

  const renderItem = useCallback(
    ({item}: {item: ListItem}) => {
      if (item.type === 'folder') {
        const folder = item.data as FolderItem;
        return (
          <TouchableOpacity
            style={[styles.row, {borderBottomColor: colors.border}]}
            activeOpacity={0.6}
            onPress={() => navigateToFolder(folder.path)}>
            <Icon
              name="folder-outline"
              size={24}
              color={colors.accent}
              style={styles.rowIcon}
            />
            <Text
              style={[styles.rowName, {color: colors.textPrimary}]}
              numberOfLines={1}>
              {folder.name}
            </Text>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        );
      }
      const file = item.data as AudioFileItem;
      const matchedTrack = findTrackForFile(file.path);
      return (
        <TouchableOpacity
          style={[styles.row, {borderBottomColor: colors.border}]}
          activeOpacity={0.6}
          onPress={() => handleAudioPress(file)}
          onLongPress={() => handleAudioLongPress(file)}>
          <Icon
            name="musical-note-outline"
            size={24}
            color={matchedTrack ? colors.accent : colors.textMuted}
            style={styles.rowIcon}
          />
          <View style={styles.rowContent}>
            <Text
              style={[styles.rowName, {color: colors.textPrimary}]}
              numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={[styles.rowSub, {color: colors.textMuted}]}>
              {formatFileSize(file.size)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [
      colors,
      navigateToFolder,
      handleAudioPress,
      handleAudioLongPress,
      findTrackForFile,
    ],
  );

  const keyExtractor = useCallback(
    (item: ListItem) =>
      item.type === 'folder'
        ? 'f:' + (item.data as FolderItem).path
        : 'a:' + (item.data as AudioFileItem).path,
    [],
  );

  // Root list of scan directories
  const renderRootList = () => (
    <FlatList
      data={scanDirectories}
      keyExtractor={item => item}
      contentContainerStyle={styles.listContent}
      renderItem={({item: dir}) => {
        const dirName = dir.split('/').pop() || dir;
        return (
          <TouchableOpacity
            style={[styles.row, {borderBottomColor: colors.border}]}
            activeOpacity={0.6}
            onPress={() => navigateToFolder(dir)}>
            <Icon
              name="folder-outline"
              size={24}
              color={colors.accent}
              style={styles.rowIcon}
            />
            <View style={styles.rowContent}>
              <Text
                style={[styles.rowName, {color: colors.textPrimary}]}
                numberOfLines={1}>
                {dirName}
              </Text>
              <Text style={[styles.rowSub, {color: colors.textMuted}]}>
                {dir}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        );
      }}
    />
  );

  const renderEmpty = () =>
    !loading ? (
      <View style={styles.empty}>
        <Icon name="folder-open-outline" size={56} color={colors.textMuted} />
        <Text
          style={{
            fontSize: sizes.lg,
            color: colors.textSecondary,
            marginTop: 16,
            fontWeight: '600',
          }}>
          {t('browse.emptyFolder')}
        </Text>
      </View>
    ) : null;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, {color: colors.textPrimary}]}>
            {t('browse.title')}
          </Text>
          {audioFiles.length > 0 && currentPath !== null && (
            <TouchableOpacity
              style={[styles.playAllBtn, {backgroundColor: colors.accent}]}
              activeOpacity={0.7}
              onPress={handlePlayAll}>
              <Icon name="play" size={14} color="#fff" />
              <Text style={styles.playAllText}>{t('browse.playAll')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Breadcrumb */}
        {(currentPath !== null || pathHistory.length > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.breadcrumbScroll}
            contentContainerStyle={styles.breadcrumbContainer}>
            <TouchableOpacity onPress={() => navigateToBreadcrumb(-1)}>
              <Icon
                name="home-outline"
                size={16}
                color={colors.accent}
                style={{marginRight: 4}}
              />
            </TouchableOpacity>
            {breadcrumbSegments.map((seg, i) => {
              const isLast = i === breadcrumbSegments.length - 1;
              return (
                <React.Fragment key={i}>
                  <Text style={[styles.breadcrumbSep, {color: colors.textMuted}]}>
                    {'>'}
                  </Text>
                  <TouchableOpacity
                    disabled={isLast}
                    onPress={() => navigateToBreadcrumb(i)}>
                    <Text
                      style={[
                        styles.breadcrumbText,
                        {
                          color: isLast ? colors.textSecondary : colors.accent,
                        },
                      ]}
                      numberOfLines={1}>
                      {seg}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : currentPath === null && showRootList ? (
        renderRootList()
      ) : (
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            listData.length === 0 && {flex: 1},
          ]}
          ListEmptyComponent={renderEmpty}
        />
      )}

      <TrackMenu
        track={menuTrack}
        visible={showMenu}
        onClose={() => {
          setShowMenu(false);
          setMenuTrack(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {paddingHorizontal: 20, paddingTop: 56},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    paddingBottom: 4,
    letterSpacing: -0.5,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  playAllText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  breadcrumbScroll: {marginTop: 4, marginBottom: 8},
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
  },
  breadcrumbSep: {marginHorizontal: 6, fontSize: 12},
  breadcrumbText: {fontSize: 13, maxWidth: 140},
  listContent: {paddingBottom: 120},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {marginRight: 14, width: 24, textAlign: 'center'},
  rowContent: {flex: 1},
  rowName: {fontSize: 15, fontWeight: '500'},
  rowSub: {fontSize: 12, marginTop: 2},
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});

export default BrowseScreen;
