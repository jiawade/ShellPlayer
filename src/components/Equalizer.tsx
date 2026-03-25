// src/components/Equalizer.tsx
import React, { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, LayoutChangeEvent, Platform } from 'react-native';
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
const KNOB_HIT_SLOP = 12; // extra touch area around knob

const BandSlider: React.FC<{
  freq: number;
  value: number;
  onChange: (v: number) => void;
  accentColor: string;
  textColor: string;
  trackColor: string;
}> = memo(({ freq, value, onChange, accentColor, textColor, trackColor }) => {
  const layoutRef = useRef({ y: 0, h: 0 });
  const [localValue, setLocalValue] = useState(value);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current) setLocalValue(value);
  }, [value]);

  const clamp = (v: number) => Math.round(Math.max(MIN_DB, Math.min(MAX_DB, v)));

  const yToDb = useCallback((absoluteY: number) => {
    const { y, h } = layoutRef.current;
    if (h <= 0) return 0;
    const ratio = 1 - (absoluteY - y) / h;
    return clamp(MIN_DB + ratio * (MAX_DB - MIN_DB));
  }, []);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const pan = useMemo(() =>
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY([-8, 8])
      .failOffsetX([-10, 10])
      .onStart((e) => {
        isDragging.current = true;
        const v = yToDb(e.absoluteY);
        setLocalValue(v);
        onChangeRef.current(v);
      })
      .onUpdate((e) => {
        const v = yToDb(e.absoluteY);
        setLocalValue(v);
        onChangeRef.current(v);
      })
      .onEnd(() => { isDragging.current = false; })
      .onFinalize(() => { isDragging.current = false; }),
    [yToDb],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    e.target.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      layoutRef.current = { y, h };
    });
  }, []);

  const displayVal = localValue;
  const pct = ((displayVal - MIN_DB) / (MAX_DB - MIN_DB)) * 100;

  return (
    <View style={sliderStyles.col}>
      <Text style={[sliderStyles.dbLabel, { color: textColor }]}>{displayVal > 0 ? `+${displayVal}` : `${displayVal}`}</Text>
      <GestureDetector gesture={pan}>
        <View
          style={sliderStyles.trackWrapper}
          onLayout={handleLayout}
        >
          <View style={[sliderStyles.track, { backgroundColor: trackColor }]}>
            <View style={[sliderStyles.centerLine, { backgroundColor: textColor, opacity: 0.2 }]} />
            <View
              style={[
                sliderStyles.fill,
                {
                  backgroundColor: accentColor,
                  bottom: displayVal >= 0 ? '50%' : `${pct}%`,
                  height: `${Math.abs(displayVal) / (MAX_DB - MIN_DB) * 100}%`,
                },
              ]}
            />
          </View>
          <View
            style={[sliderStyles.knob, { backgroundColor: accentColor, bottom: `${pct - 5}%` }]}
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
              {/* dB scale + band sliders in a row to prevent overlap */}
              <View style={styles.eqRow}>
                <View style={styles.scaleLabels}>
                  <Text style={[styles.scaleTxt, { color: colors.textMuted }]}>+{MAX_DB}</Text>
                  <Text style={[styles.scaleTxt, { color: colors.textMuted }]}>0</Text>
                  <Text style={[styles.scaleTxt, { color: colors.textMuted }]}>{MIN_DB}</Text>
                </View>
                {/* Band sliders */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slidersRow}>
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
                </ScrollView>
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
  col: { alignItems: 'center', width: 36, marginHorizontal: 4 },
  dbLabel: { fontSize: 9, fontWeight: '600', marginBottom: 4 },
  trackWrapper: { width: 16, height: 160, alignItems: 'center', position: 'relative' },
  track: { width: 6, height: '100%', borderRadius: 3, position: 'absolute', left: 5, overflow: 'hidden' },
  centerLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1 },
  fill: { position: 'absolute', left: 0, right: 0, borderRadius: 3 },
  knob: { position: 'absolute', left: 0, width: 16, height: 16, borderRadius: 8 },
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
  customWrap: { paddingHorizontal: 12, paddingTop: 8, alignItems: 'center' },
  eqRow: { flexDirection: 'row', alignItems: 'center' },
  scaleLabels: { width: 28, height: 160, justifyContent: 'space-between', marginTop: 14 },
  scaleTxt: { fontSize: 8, textAlign: 'right' },
  slidersRow: { paddingLeft: 4, paddingRight: 8, alignItems: 'flex-end' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, marginTop: 16 },
});

export default memo(Equalizer);
