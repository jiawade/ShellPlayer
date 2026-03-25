// src/components/Equalizer.tsx
import React, { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Platform } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { applyEQPreset, getSavedPresetId, applyCustomBands, getSavedCustomBands, getBandFrequencies, getDefaultBands } from '../utils/equalizer';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { hapticLight, hapticSelection } from '../utils/haptics';

const EQ_PRESETS = [
  { id: 0, nameKey: 'equalizer.presets.off.name', icon: 'ban-outline', descKey: 'equalizer.presets.off.desc' },
  { id: 1, nameKey: 'equalizer.presets.3dSurround.name', icon: 'globe-outline', descKey: 'equalizer.presets.3dSurround.desc' },
  { id: 2, nameKey: 'equalizer.presets.jazz.name', icon: 'wine-outline', descKey: 'equalizer.presets.jazz.desc' },
  { id: 3, nameKey: 'equalizer.presets.pop.name', icon: 'star-outline', descKey: 'equalizer.presets.pop.desc' },
  { id: 4, nameKey: 'equalizer.presets.rock.name', icon: 'flash-outline', descKey: 'equalizer.presets.rock.desc' },
  { id: 5, nameKey: 'equalizer.presets.classical.name', icon: 'musical-note-outline', descKey: 'equalizer.presets.classical.desc' },
  { id: 6, nameKey: 'equalizer.presets.hiphop.name', icon: 'mic-outline', descKey: 'equalizer.presets.hiphop.desc' },
  { id: 7, nameKey: 'equalizer.presets.electronic.name', icon: 'pulse-outline', descKey: 'equalizer.presets.electronic.desc' },
  { id: 8, nameKey: 'equalizer.presets.randb.name', icon: 'heart-outline', descKey: 'equalizer.presets.randb.desc' },
  { id: 9, nameKey: 'equalizer.presets.vocals.name', icon: 'person-outline', descKey: 'equalizer.presets.vocals.desc' },
  { id: 10, nameKey: 'equalizer.presets.deepBass.name', icon: 'volume-high-outline', descKey: 'equalizer.presets.deepBass.desc' },
  { id: 11, nameKey: 'equalizer.presets.live.name', icon: 'people-outline', descKey: 'equalizer.presets.live.desc' },
];

const MIN_DB = -12;
const MAX_DB = 12;

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
}

/* ── Vertical band slider ─────────────────────────── */
const KNOB_SIZE = 16;
const TRACK_HEIGHT = 160;

const BandSlider: React.FC<{
  freq: number;
  value: number;
  onChange: (v: number) => void;
  accentColor: string;
  textColor: string;
  trackColor: string;
}> = memo(({ freq, value, onChange, accentColor, textColor, trackColor }) => {
  const [localValue, setLocalValue] = useState(value);
  const isDragging = useRef(false);
  const startDbRef = useRef(0);

  useEffect(() => {
    if (!isDragging.current) setLocalValue(value);
  }, [value]);

  const clamp = (v: number) => Math.round(Math.max(MIN_DB, Math.min(MAX_DB, v)));

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const pan = useMemo(() =>
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY([-4, 4])
      .failOffsetX([-12, 12])
      .onStart(() => {
        isDragging.current = true;
        startDbRef.current = localValue;
      })
      .onUpdate((e) => {
        // translationY < 0 = finger moved up = increase dB
        const dbRange = MAX_DB - MIN_DB;
        const dbDelta = -(e.translationY / TRACK_HEIGHT) * dbRange;
        const v = clamp(startDbRef.current + dbDelta);
        setLocalValue(v);
        onChangeRef.current(v);
      })
      .onEnd(() => { isDragging.current = false; })
      .onFinalize(() => { isDragging.current = false; }),
    [localValue],
  );

  const displayVal = localValue;
  const pct = (displayVal - MIN_DB) / (MAX_DB - MIN_DB);
  const knobBottom = pct * TRACK_HEIGHT - KNOB_SIZE / 2;

  return (
    <View style={sliderStyles.col}>
      <Text style={[sliderStyles.dbLabel, { color: textColor }]}>{displayVal > 0 ? `+${displayVal}` : `${displayVal}`}</Text>
      <GestureDetector gesture={pan}>
        <View style={sliderStyles.trackWrapper}>
          <View style={[sliderStyles.track, { backgroundColor: trackColor }]}>
            <View style={[sliderStyles.centerLine, { backgroundColor: textColor, opacity: 0.2 }]} />
            <View
              style={[
                sliderStyles.fill,
                {
                  backgroundColor: accentColor,
                  bottom: displayVal >= 0 ? '50%' : `${pct * 100}%`,
                  height: `${(Math.abs(displayVal) / (MAX_DB - MIN_DB)) * 100}%`,
                },
              ]}
            />
          </View>
          <View
            style={[sliderStyles.knob, { backgroundColor: accentColor, bottom: knobBottom }]}
          />
        </View>
      </GestureDetector>
      <Text style={[sliderStyles.freqLabel, { color: textColor }]}>{formatFreq(freq)}</Text>
    </View>
  );
});

interface Props { visible: boolean; onClose: () => void; }

const Equalizer: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [applying, setApplying] = useState(false);
  const [tab, setTab] = useState<'preset' | 'custom'>('preset');
  const [bands, setBands] = useState<number[]>(getDefaultBands);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      getSavedPresetId().then(id => {
        setActive(id);
        setTab(id === -1 ? 'custom' : 'preset');
      });
      getSavedCustomBands().then(b => { if (b) setBands(b); });
    }
  }, [visible]);

  const handleSelect = async (id: number) => {
    hapticLight();
    setActive(id);
    setApplying(true);
    await applyEQPreset(id);
    setApplying(false);
  };

  const handleBandChange = useCallback((index: number, value: number) => {
    setBands(prev => {
      const next = [...prev];
      next[index] = value;
      // Debounce native call
      if (applyTimer.current) clearTimeout(applyTimer.current);
      applyTimer.current = setTimeout(() => {
        applyCustomBands(next);
      }, 80);
      return next;
    });
    setActive(-1);
  }, []);

  const handleResetBands = useCallback(() => {
    const zeroed = getDefaultBands();
    setBands(zeroed);
    applyCustomBands(zeroed);
    setActive(-1);
  }, []);

  if (!visible) return null;

  const freqs = getBandFrequencies();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={{ fontSize: sizes.xl, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{t('equalizer.title')}</Text>
            {applying && <Text style={{ fontSize: sizes.xs, color: colors.accent, marginRight: 12 }}>{t('equalizer.applying')}</Text>}
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'preset' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
              onPress={() => setTab('preset')}>
              <Text style={{ fontSize: sizes.md, fontWeight: '600', color: tab === 'preset' ? colors.accent : colors.textSecondary }}>{t('equalizer.presetTab')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'custom' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
              onPress={() => setTab('custom')}>
              <Text style={{ fontSize: sizes.md, fontWeight: '600', color: tab === 'custom' ? colors.accent : colors.textSecondary }}>{t('equalizer.customTab')}</Text>
            </TouchableOpacity>
          </View>

          {tab === 'preset' ? (
            <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {EQ_PRESETS.map(p => {
                const on = active === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.card, {
                      backgroundColor: on ? colors.accentDim : colors.bgCard,
                      borderColor: on ? colors.accent : colors.border,
                    }]}
                    onPress={() => handleSelect(p.id)}
                    activeOpacity={0.7}>
                    <View style={[styles.iconW, {
                      backgroundColor: on ? colors.accent : colors.bgElevated,
                    }]}>
                      <Icon name={p.icon} size={24} color={on ? colors.bg : colors.textSecondary} />
                    </View>
                    <Text style={{ fontSize: sizes.md, fontWeight: '600', color: on ? colors.accent : colors.textPrimary, marginBottom: 4 }}>{t(p.nameKey)}</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>{t(p.descKey)}</Text>
                    {on && <View style={styles.badge}><Icon name="checkmark-circle" size={16} color={colors.accent} /></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.customWrap}>
              {/* dB scale + band sliders in a centered row */}
              <View style={styles.eqRow}>
                <View style={styles.scaleLabels}>
                  <Text style={[styles.scaleTxt, { color: colors.textMuted }]}>+{MAX_DB}</Text>
                  <Text style={[styles.scaleTxt, { color: colors.textMuted }]}>0</Text>
                  <Text style={[styles.scaleTxt, { color: colors.textMuted }]}>{MIN_DB}</Text>
                </View>
                {/* Band sliders - no horizontal scroll, flex to fill and center */}
                <View style={styles.slidersRow}>
                  {freqs.map((freq, i) => (
                    <BandSlider
                      key={freq}
                      freq={freq}
                      value={bands[i] ?? 0}
                      onChange={(v) => handleBandChange(i, v)}
                      accentColor={colors.accent}
                      textColor={colors.textSecondary}
                      trackColor={colors.bgCard}
                    />
                  ))}
                </View>
              </View>
              {/* Platform info hint */}
              <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 }}>
                {Platform.OS === 'ios'
                  ? t('equalizer.platformHint.ios')
                  : t('equalizer.platformHint.android')}
              </Text>
              {/* Reset button */}
              <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.border }]} onPress={handleResetBands}>
                <Icon name="refresh-outline" size={16} color={colors.textSecondary} />
                <Text style={{ fontSize: sizes.sm, color: colors.textSecondary, marginLeft: 6 }}>{t('equalizer.reset')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
};

const sliderStyles = StyleSheet.create({
  col: { alignItems: 'center', flex: 1, minWidth: 30, maxWidth: 44 },
  dbLabel: { fontSize: 9, fontWeight: '600', marginBottom: 4 },
  trackWrapper: { width: 20, height: TRACK_HEIGHT, alignItems: 'center', position: 'relative' },
  track: { width: 6, height: TRACK_HEIGHT, borderRadius: 3, position: 'absolute', left: 7, overflow: 'hidden' },
  centerLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1 },
  fill: { position: 'absolute', left: 0, right: 0, borderRadius: 3 },
  knob: { position: 'absolute', left: 0, width: 20, height: KNOB_SIZE, borderRadius: KNOB_SIZE / 2 },
  freqLabel: { fontSize: 8, marginTop: 4, fontWeight: '500' },
});

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingBottom: 34, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, marginBottom: 12 },
  tabBtn: { paddingBottom: 10, marginRight: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  card: { width: '30%', minWidth: 100, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, position: 'relative' },
  iconW: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badge: { position: 'absolute', top: 8, right: 8 },
  customWrap: { paddingHorizontal: 8, paddingTop: 8, alignItems: 'center' },
  eqRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  scaleLabels: { width: 28, height: TRACK_HEIGHT, justifyContent: 'space-between', marginTop: 14 },
  scaleTxt: { fontSize: 8, textAlign: 'right' },
  slidersRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, marginTop: 16 },
});

export default memo(Equalizer);
