// src/components/PlayQueueView.tsx
import React, {memo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPlayer from 'react-native-track-player';
import CoverArt from './CoverArt';
import {useAppSelector} from '../store';
import {Track} from '../types';
import {useTheme} from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const PlayQueueView: React.FC<Props> = ({visible, onClose}) => {
  const {playQueue, currentTrack} = useAppSelector(s => s.music);
  const {colors, sizes} = useTheme();
  const { t } = useTranslation();

  const handlePlayFromQueue = useCallback(
    async (track: Track, _index: number) => {
      try {
        const queue = await TrackPlayer.getQueue();
        const queueIdx = queue.findIndex(t => t.id === track.id);
        if (queueIdx >= 0) {
          await TrackPlayer.skip(queueIdx);
          await TrackPlayer.play();
        }
      } catch {}
    },
    [],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, {backgroundColor: colors.overlay}]}
        onPress={onClose}>
        <Pressable
          style={[styles.sheet, {backgroundColor: colors.bgElevated}]}
          onPress={() => {}}>
          <View style={styles.header}>
            <Text
              style={{
                fontSize: sizes.xl,
                fontWeight: '700',
                color: colors.textPrimary,
                flex: 1,
              }}>
              {t('playQueue.title')}
            </Text>
            <Text
              style={{
                fontSize: sizes.sm,
                color: colors.textMuted,
                marginRight: 12,
              }}>
              {playQueue.length} {t('playQueue.countFormat')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={playQueue}
            keyExtractor={(item, idx) => `${item.id}-${idx}`}
            contentContainerStyle={{paddingBottom: 20}}
            showsVerticalScrollIndicator={false}
            renderItem={({item, index}) => {
              const isActive = currentTrack?.id === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.queueItem,
                    {borderBottomColor: colors.border},
                    isActive && {backgroundColor: colors.accentDim},
                  ]}
                  onPress={() => handlePlayFromQueue(item, index)}
                  activeOpacity={0.7}>
                  <Text
                    style={{
                      width: 28,
                      fontSize: sizes.sm,
                      color: isActive ? colors.accent : colors.textMuted,
                      textAlign: 'center',
                      fontVariant: ['tabular-nums'],
                    }}>
                    {isActive ? '▶' : String(index + 1)}
                  </Text>
                  <CoverArt artwork={item.artwork} size={40} borderRadius={8} />
                  <View style={styles.queueInfo}>
                    <Text
                      style={{
                        fontSize: sizes.md,
                        color: isActive ? colors.accent : colors.textPrimary,
                        fontWeight: '600',
                      }}
                      numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text
                      style={{fontSize: sizes.xs, color: colors.textSecondary}}
                      numberOfLines={1}>
                      {item.artist}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyQueue}>
                <Icon name="list-outline" size={48} color={colors.textMuted} />
                <Text
                  style={{
                    fontSize: sizes.md,
                    color: colors.textMuted,
                    marginTop: 12,
                  }}>
                  {t('playQueue.empty')}
                </Text>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  queueInfo: {flex: 1},
  emptyQueue: {alignItems: 'center', marginTop: 40},
});

export default memo(PlayQueueView);
