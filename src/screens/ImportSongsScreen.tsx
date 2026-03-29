// src/screens/ImportSongsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import {
  scanMusic,
  importiOSMediaLibrary,
  IOSImportOptions,
} from '../store/musicSlice';
import FolderPickerScreen from './FolderPickerScreen';
import SwipeBackWrapper from '../components/SwipeBackWrapper';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const ImportSongsScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { tracks, isScanning, scanDirectories, scanProgress } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const goToAllSongs = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'AllSongs' } }],
      }),
    );
  }, [navigation]);

  const handleLocalImport = () => {
    setShowFolderPicker(true);
  };

  const handleFolderConfirm = useCallback(
    async (dirs: string[]) => {
      // Don't close modal — FolderPickerScreen will show progress and close when done
      await dispatch(scanMusic(dirs));
      setShowFolderPicker(false);
      goToAllSongs();
    },
    [dispatch, goToAllSongs],
  );

  const handleIOSImport = useCallback(
    async (opts: IOSImportOptions) => {
      // Don't close modal — FolderPickerScreen will show progress and close when done
      await dispatch(importiOSMediaLibrary(opts));
      setShowFolderPicker(false);
      goToAllSongs();
    },
    [dispatch, goToAllSongs],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.stickyHeader, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t('importSongs.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* 音乐库统计 */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('importSongs.library')}</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.accent }]}>{tracks.length}</Text>
                <Text style={[styles.statLbl, { color: colors.textMuted }]}>{t('importSongs.songCount')}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.accent }]}>
                  {tracks.filter(t => t.lrcPath || t.embeddedLyrics).length}
                </Text>
                <Text style={[styles.statLbl, { color: colors.textMuted }]}>{t('importSongs.withLyrics')}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.accent }]}>
                  {tracks.filter(t => t.isFavorite).length}
                </Text>
                <Text style={[styles.statLbl, { color: colors.textMuted }]}>{t('importSongs.favorites')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 导入操作 */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, { color: colors.textMuted }]}>{t('importSongs.actions')}</Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accentDim }]}
            onPress={handleLocalImport}
            disabled={isScanning}>
            {isScanning ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Icon
                name={Platform.OS === 'ios' ? 'musical-notes' : 'folder-open-outline'}
                size={20}
                color={colors.accent}
              />
            )}
            <Text style={[styles.actionTxt, { color: colors.accent }]}>
              {isScanning
                ? scanProgress?.phase === 'parsing' && scanProgress.total > 0
                  ? t('importSongs.importingProgress', {
                      percent: Math.round((scanProgress.current / scanProgress.total) * 100),
                    })
                  : t('importSongs.scanning')
                : t('importSongs.localImport')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accentDim, marginTop: 10 }]}
            onPress={() => navigation.navigate('WifiTransfer')}>
            <Icon name="wifi-outline" size={20} color={colors.accent} />
            <Text style={[styles.actionTxt, { color: colors.accent }]}>{t('importSongs.wifiImport')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showFolderPicker} animationType="slide">
        <SwipeBackWrapper onSwipeBack={() => setShowFolderPicker(false)}>
          <FolderPickerScreen
            onConfirm={handleFolderConfirm}
            onCancel={() => setShowFolderPicker(false)}
            initialSelected={Platform.OS === 'ios' ? [] : scanDirectories}
            onIOSImport={Platform.OS === 'ios' ? handleIOSImport : undefined}
          />
        </SwipeBackWrapper>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: { paddingHorizontal: 20 },
  section: { marginBottom: 28 },
  secTitle: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  card: { borderRadius: 20, padding: 16, borderWidth: 1 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '700' },
  statLbl: { fontSize: 10, marginTop: 4 },
  divider: { width: 1, height: 36 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionTxt: { fontSize: 14, fontWeight: '600' },
  dirItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  dirTxt: { flex: 1, fontSize: 12 },
});

export default ImportSongsScreen;
