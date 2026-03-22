// src/components/SleepTimer.tsx
import React, { memo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPlayer from 'react-native-track-player';
import { useAppSelector, useAppDispatch } from '../store';
import { setSleepTimer } from '../store/musicSlice';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const TIMER_OPTIONS = [
  { labelKey: 'sleepTimer.options.15min', minutes: 15 },
  { labelKey: 'sleepTimer.options.30min', minutes: 30 },
  { labelKey: 'sleepTimer.options.45min', minutes: 45 },
  { labelKey: 'sleepTimer.options.60min', minutes: 60 },
  { labelKey: 'sleepTimer.options.90min', minutes: 90 },
];

interface Props { visible: boolean; onClose: () => void; }

const SleepTimer: React.FC<Props> = ({ visible, onClose }) => {
  const dispatch = useAppDispatch();
  const { sleepTimerEnd } = useAppSelector(s => s.music);
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sleepTimerEnd && sleepTimerEnd > Date.now()) {
      timerRef.current = setInterval(() => {
        const left = sleepTimerEnd - Date.now();
        if (left <= 0) {
          TrackPlayer.pause().catch(() => {});
          dispatch(setSleepTimer(null));
          if (timerRef.current) clearInterval(timerRef.current);
          setRemaining('');
        } else {
          const m = Math.floor(left / 60000);
          const s = Math.floor((left % 60000) / 1000);
          setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
        }
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sleepTimerEnd, dispatch]);

  const handleSet = (minutes: number) => {
    dispatch(setSleepTimer(Date.now() + minutes * 60000));
    onClose();
  };

  const handleCancel = () => {
    dispatch(setSleepTimer(null));
    setRemaining('');
    onClose();
  };

  if (!visible) return null;

  const hasTimer = sleepTimerEnd && sleepTimerEnd > Date.now();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={{ fontSize: sizes.xl, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{t('sleepTimer.title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {hasTimer && (
            <View style={[styles.activeTimer, { backgroundColor: colors.accentDim }]}>
              <Icon name="moon" size={20} color={colors.accent} />
              <Text style={{ fontSize: sizes.lg, color: colors.accent, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{remaining}</Text>
              <Text style={{ fontSize: sizes.sm, color: colors.textMuted }}>{t('sleepTimer.willStop')}</Text>
            </View>
          )}

          {TIMER_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.minutes} style={[styles.option, { borderBottomColor: colors.border }]} onPress={() => handleSet(opt.minutes)} activeOpacity={0.6}>
              <Icon name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '500' }}>{t(opt.labelKey)}</Text>
            </TouchableOpacity>
          ))}

          {hasTimer && (
            <TouchableOpacity style={[styles.cancelTimerBtn, { backgroundColor: colors.bgCard }]} onPress={handleCancel} activeOpacity={0.7}>
              <Text style={{ fontSize: sizes.md, color: colors.heart, fontWeight: '600' }}>{t('sleepTimer.cancelButton')}</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  activeTimer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  cancelTimerBtn: { marginHorizontal: 16, marginTop: 12, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});

export default memo(SleepTimer);
