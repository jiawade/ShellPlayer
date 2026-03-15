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
import { COLORS, SIZES } from '../utils/theme';

interface Props {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
}

const TrackMenu: React.FC<Props> = ({ track, visible, onClose }) => {
  const dispatch = useAppDispatch();
  const [showInfo, setShowInfo] = React.useState(false);

  const handlePlayNext = useCallback(async () => {
    if (!track) return;
    try {
      const queue = await TrackPlayer.getQueue();
      const currentIdx = await TrackPlayer.getActiveTrackIndex();
      const insertIdx = (currentIdx ?? 0) + 1;
      // 如果已在队列中先移除
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
          onPress: () => {
            dispatch(deleteTrackPermanently(track.id));
            onClose();
          },
        },
      ],
    );
  }, [track, dispatch, onClose]);

  const handleShowInfo = useCallback(() => {
    setShowInfo(true);
  }, []);

  if (!track) return null;

  // 歌曲信息详情页
  if (showInfo) {
    const ext = track.fileName.substring(track.fileName.lastIndexOf('.') + 1).toUpperCase();
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { setShowInfo(false); onClose(); }}>
        <Pressable style={styles.overlay} onPress={() => { setShowInfo(false); onClose(); }}>
          <Pressable style={styles.infoSheet} onPress={() => {}}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>歌曲信息</Text>
              <TouchableOpacity onPress={() => { setShowInfo(false); onClose(); }} hitSlop={12}>
                <Icon name="close" size={22} color={COLORS.textSecondary} />
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
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* 歌曲标题 */}
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.menuSubtitle} numberOfLines={1}>{track.artist}</Text>
          </View>

          {/* 下一首播放 */}
          <TouchableOpacity style={styles.menuItem} onPress={handlePlayNext} activeOpacity={0.6}>
            <Icon name="play-forward-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.menuItemText}>下一首播放</Text>
          </TouchableOpacity>

          {/* 歌曲信息 */}
          <TouchableOpacity style={styles.menuItem} onPress={handleShowInfo} activeOpacity={0.6}>
            <Icon name="information-circle-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.menuItemText}>歌曲信息</Text>
          </TouchableOpacity>

          {/* 从列表移除 */}
          <TouchableOpacity style={styles.menuItem} onPress={handleHide} activeOpacity={0.6}>
            <Icon name="eye-off-outline" size={20} color={COLORS.secondary} />
            <Text style={[styles.menuItemText, { color: COLORS.secondary }]}>从列表中移除</Text>
          </TouchableOpacity>

          {/* 永久删除 */}
          <TouchableOpacity style={styles.menuItem} onPress={handleDeletePermanent} activeOpacity={0.6}>
            <Icon name="trash-outline" size={20} color={COLORS.heart} />
            <Text style={[styles.menuItemText, { color: COLORS.heart }]}>永久删除文件</Text>
          </TouchableOpacity>

          {/* 取消 */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} selectable>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgElevated,
    borderTopLeftRadius: SIZES.radiusXl, borderTopRightRadius: SIZES.radiusXl,
    paddingTop: 8, paddingBottom: 34,
  },
  menuHeader: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  menuTitle: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  menuSubtitle: { fontSize: SIZES.sm, color: COLORS.textMuted, marginTop: 2 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  menuItemText: { fontSize: SIZES.md, color: COLORS.textPrimary, fontWeight: '500' },
  cancelBtn: {
    marginHorizontal: 16, marginTop: 8,
    paddingVertical: 14, borderRadius: SIZES.radius,
    backgroundColor: COLORS.bgCard, alignItems: 'center',
  },
  cancelText: { fontSize: SIZES.md, color: COLORS.textSecondary, fontWeight: '600' },
  // 歌曲信息
  infoSheet: {
    backgroundColor: COLORS.bgElevated,
    borderTopLeftRadius: SIZES.radiusXl, borderTopRightRadius: SIZES.radiusXl,
    paddingTop: 8, paddingBottom: 34, maxHeight: '80%',
  },
  infoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoTitle: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textPrimary },
  infoScroll: { paddingHorizontal: 20 },
  infoRow: {
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: SIZES.sm, color: COLORS.textMuted, marginBottom: 4 },
  infoValue: { fontSize: SIZES.md, color: COLORS.textPrimary, lineHeight: 22 },
});

export default memo(TrackMenu);
