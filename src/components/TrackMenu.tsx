// src/components/TrackMenu.tsx
import React, { memo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Pressable, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPlayer from 'react-native-track-player';
import { useNavigation } from '@react-navigation/native';
import { Track } from '../types';
import { useAppDispatch } from '../store';
import { hideTrack, deleteTrackPermanently } from '../store/musicSlice';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface Props {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
}

const TrackMenu: React.FC<Props> = ({ track, visible, onClose }) => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
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
      t('trackMenu.deleteAlert.title'),
      t('trackMenu.deleteAlert.message', { title: track.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trackMenu.deleteAlert.confirm'), style: 'destructive',
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
          <View style={[styles.infoSheet, { backgroundColor: colors.bgElevated }]}>
            <View style={[styles.infoHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: sizes.lg, fontWeight: '700', color: colors.textPrimary }}>{t('trackMenu.infoPanel.title')}</Text>
              <TouchableOpacity onPress={() => { setShowInfo(false); onClose(); }} hitSlop={12}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={true} bounces={true}>
              <InfoRow label={t('trackMenu.infoPanel.titleLabel')} value={track.title} />
              <InfoRow label={t('trackMenu.infoPanel.artistLabel')} value={track.artist} />
              <InfoRow label={t('trackMenu.infoPanel.albumLabel')} value={track.album} />
              {track.year ? <InfoRow label={t('trackMenu.infoPanel.yearLabel')} value={track.year} /> : null}
              {track.genre ? <InfoRow label={t('trackMenu.infoPanel.genreLabel')} value={track.genre} /> : null}
              {track.trackNumber ? <InfoRow label={t('trackMenu.infoPanel.trackNumberLabel')} value={track.trackNumber} /> : null}
              {track.composer ? <InfoRow label={t('trackMenu.infoPanel.composerLabel')} value={track.composer} /> : null}
              {track.comment ? <InfoRow label={t('trackMenu.infoPanel.commentLabel')} value={track.comment} /> : null}
              <InfoRow label={t('trackMenu.infoPanel.formatLabel')} value={ext} />
              <InfoRow label={t('trackMenu.infoPanel.filenameLabel')} value={track.fileName} />
              <InfoRow label={t('trackMenu.infoPanel.lyricsLabel')} value={track.lrcPath ? t('trackMenu.infoPanel.hasLyrics') : track.embeddedLyrics ? t('trackMenu.infoPanel.hasLyrics') : t('trackMenu.infoPanel.noLyrics')} />
              <InfoRow label={t('trackMenu.infoPanel.artworkLabel')} value={track.artwork ? t('trackMenu.infoPanel.hasArtwork') : t('trackMenu.infoPanel.noArtwork')} />
            </ScrollView>
          </View>
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
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>{t('trackMenu.playNext')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleShowInfo} activeOpacity={0.6}>
            <Icon name="information-circle-outline" size={20} color={colors.textPrimary} />
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>{t('trackMenu.info')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); navigation.navigate('TagEditor', { track }); }} activeOpacity={0.6}>
            <Icon name="create-outline" size={20} color={colors.textPrimary} />
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>{t('trackMenu.editTags')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleHide} activeOpacity={0.6}>
            <Icon name="eye-off-outline" size={20} color={colors.secondary} />
            <Text style={{ fontSize: sizes.md, color: colors.secondary, fontWeight: '500' }}>{t('trackMenu.hide')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleDeletePermanent} activeOpacity={0.6}>
            <Icon name="trash-outline" size={20} color={colors.heart} />
            <Text style={{ fontSize: sizes.md, color: colors.heart, fontWeight: '500' }}>{t('trackMenu.delete')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.bgCard }]} onPress={onClose} activeOpacity={0.7}>
            <Text style={{ fontSize: sizes.md, color: colors.textSecondary, fontWeight: '600' }}>{t('trackMenu.cancel')}</Text>
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
