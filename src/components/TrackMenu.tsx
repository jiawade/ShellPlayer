// src/components/TrackMenu.tsx
import React, { memo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Pressable, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPlayer from 'react-native-track-player';
import { Track } from '../types';
import { useAppDispatch } from '../store';
import { hideTrack, deleteTrackPermanently } from '../store/musicSlice';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
}

const TrackMenu: React.FC<Props> = ({ track, visible, onClose }) => {
  const dispatch = useAppDispatch();
  const { colors, sizes } = useTheme();
  const [showInfo, setShowInfo] = React.useState(false);

  const handlePlayNext = useCallback(async () => {
    if (!track) return;
    try {
      const queue = await TrackPlayer.getQueue();
      const currentIdx = await TrackPlayer.getActiveTrackIndex();
      const insertIdx = (currentIdx ?? 0) + 1;
      const existIdx = queue.findIndex(t => t.id === track.id);
      if (existIdx >= 0) await TrackPlayer.remove(existIdx);
      await TrackPlayer.add({
        id: track.id, url: track.url,
        title: track.title, artist: track.artist, artwork: track.artwork,
      }, insertIdx);
    } catch (e) {
      console.warn('Insert next failed:', e);
    }
    onClose();
  }, [track, onClose]);

  const handleHide = useCallback(() => {
    if (!track) return;
    dispatch(hideTrack(track.id));
    onClose();
  }, [track, dispatch, onClose]);

  const handleDeletePermanent = useCallback(() => {
    if (!track) return;
    Alert.alert(
      '永久删除',
      `确定要从存储中永久删除「${track.title}」吗？\n此操作不可撤销！`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定删除', style: 'destructive',
          onPress: () => { dispatch(deleteTrackPermanently(track.id)); onClose(); },
        },
      ],
    );
  }, [track, dispatch, onClose]);

  const handleShowInfo = useCallback(() => { setShowInfo(true); }, []);

  if (!track) return null;

  const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: sizes.md, color: colors.textPrimary, lineHeight: 22 }} selectable>{value}</Text>
    </View>
  );

  if (showInfo) {
    const ext = track.fileName.substring(track.fileName.lastIndexOf('.') + 1).toUpperCase();
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setShowInfo(false); onClose(); }}>
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => { setShowInfo(false); onClose(); }}>
          <Pressable style={[styles.infoSheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
            <View style={[styles.infoHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: sizes.lg, fontWeight: '700', color: colors.textPrimary }}>歌曲信息</Text>
              <TouchableOpacity onPress={() => { setShowInfo(false); onClose(); }} hitSlop={12}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
              <InfoRow label="标题" value={track.title} />
              <InfoRow label="歌手" value={track.artist} />
              <InfoRow label="专辑" value={track.album} />
              <InfoRow label="格式" value={ext} />
              <InfoRow label="文件名" value={track.fileName} />
              <InfoRow label="文件路径" value={track.filePath} />
              <InfoRow label="歌词文件" value={track.lrcPath ? '有 (.lrc)' : track.embeddedLyrics ? '有 (内嵌)' : '无'} />
              <InfoRow label="封面" value={track.artwork ? '有' : '无'} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
          <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ fontSize: sizes.lg, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>{track.title}</Text>
            <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{track.artist}</Text>
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={handlePlayNext} activeOpacity={0.6}>
            <Icon name="play-forward-outline" size={20} color={colors.textPrimary} />
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>下一首播放</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleShowInfo} activeOpacity={0.6}>
            <Icon name="information-circle-outline" size={20} color={colors.textPrimary} />
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>歌曲信息</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleHide} activeOpacity={0.6}>
            <Icon name="eye-off-outline" size={20} color={colors.secondary} />
            <Text style={{ fontSize: sizes.md, color: colors.secondary, fontWeight: '500' }}>从列表中移除</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleDeletePermanent} activeOpacity={0.6}>
            <Icon name="trash-outline" size={20} color={colors.heart} />
            <Text style={{ fontSize: sizes.md, color: colors.heart, fontWeight: '500' }}>永久删除文件</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.bgCard }]} onPress={onClose} activeOpacity={0.7}>
            <Text style={{ fontSize: sizes.md, color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingBottom: 34 },
  menuHeader: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  cancelBtn: { marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  infoSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingBottom: 34, maxHeight: '80%' },
  infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  infoScroll: { paddingHorizontal: 20 },
  infoRow: { paddingVertical: 14, borderBottomWidth: 1 },
});

export default memo(TrackMenu);
