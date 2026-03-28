// src/screens/RhythmLightScreen.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  AppState,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../store';
import { usePlayerControls } from '../hooks/usePlayerProgress';
import CoverArt from '../components/CoverArt';
import {
  startAudioLevelMonitoring,
  stopAudioLevelMonitoring,
  addAudioLevelListener,
} from '../utils/audioLevel';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import VUMeter from '../components/visualizers/VUMeter';
import WaveformView from '../components/visualizers/WaveformView';
import ClassicLED from '../components/visualizers/ClassicLED';
import MirrorWave from '../components/visualizers/MirrorWave';
import SpeakerView, { SPEAKER_IMAGES } from '../components/visualizers/SpeakerView';
import MatrixGrid from '../components/visualizers/MatrixGrid';

const NUM_COLS = 16;
Dimensions.get('window').height;
const GRID_H_PAD = 20;
const TAU = Math.PI * 2;
const RHYTHM_PREFS_KEY = '@rhythmLightPrefs';

type VisualizerMode = 'classic' | 'mirror' | 'speaker' | 'matrix' | 'vumeter' | 'waveform';

const VISUALIZER_MODES: Array<{ key: VisualizerMode; labelKey: string; icon: string }> = [
  { key: 'classic', labelKey: 'rhythmLight.modes.classic', icon: 'apps-outline' },
  { key: 'mirror', labelKey: 'rhythmLight.modes.mirror', icon: 'swap-vertical-outline' },
  { key: 'speaker', labelKey: 'rhythmLight.modes.speaker', icon: 'volume-high-outline' },
  { key: 'matrix', labelKey: 'rhythmLight.modes.matrix', icon: 'grid-outline' },
  { key: 'vumeter', labelKey: 'rhythmLight.modes.vumeter', icon: 'speedometer-outline' },
  { key: 'waveform', labelKey: 'rhythmLight.modes.waveform', icon: 'pulse-outline' },
];

const RhythmLightScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentTrack, isPlaying } = useAppSelector(s => s.music);
  const { togglePlayPause, skipToNext, skipToPrevious } = usePlayerControls();
  const { t } = useTranslation();
  const [levels, setLevels] = useState<number[]>(() => new Array(NUM_COLS).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(NUM_COLS).fill(0));
  const [mode, setMode] = useState<VisualizerMode>('classic');
  const [speakerImgIdx, setSpeakerImgIdx] = useState(() =>
    Math.floor(Math.random() * SPEAKER_IMAGES.length),
  );
  const [, setMotionPhase] = useState(0);
  const [spkBeatMode, setSpkBeatMode] = useState(true);

  const rawTargetsRef = useRef(new Array(NUM_COLS).fill(0));
  const currentRef = useRef(new Array(NUM_COLS).fill(0));
  const peaksRef = useRef(new Array(NUM_COLS).fill(0));
  const animRef = useRef(0);
  const frameRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const appActiveRef = useRef(true);
  const monitoringActiveRef = useRef(false);
  const listenerRemoverRef = useRef<(() => void) | null>(null);
  const systemVolumeRef = useRef(1);
  // Beat detection refs
  const prevEnergyRef = useRef(0);
  const fluxHistoryRef = useRef<number[]>([]);
  const beatLevelRef = useRef(0);

  // Restore last selected mode/beat switch/speaker image index after app relaunch.
  useEffect(() => {
    let cancelled = false;
    const loadPrefs = async () => {
      try {
        const raw = await AsyncStorage.getItem(RHYTHM_PREFS_KEY);
        if (!raw || cancelled) {
          return;
        }
        const parsed = JSON.parse(raw) as {
          mode?: VisualizerMode;
          spkBeatMode?: boolean;
          speakerImgIdx?: number;
        };

        if (parsed.mode && VISUALIZER_MODES.some(v => v.key === parsed.mode)) {
          setMode(parsed.mode);
        }
        if (typeof parsed.spkBeatMode === 'boolean') {
          setSpkBeatMode(parsed.spkBeatMode);
        }
        if (typeof parsed.speakerImgIdx === 'number') {
          const safeIdx = Math.max(
            0,
            Math.min(SPEAKER_IMAGES.length - 1, Math.floor(parsed.speakerImgIdx)),
          );
          setSpeakerImgIdx(safeIdx);
        }
      } catch {
        // Ignore invalid persisted data and keep defaults.
      }
    };
    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      RHYTHM_PREFS_KEY,
      JSON.stringify({ mode, spkBeatMode, speakerImgIdx }),
    ).catch(() => {});
  }, [mode, spkBeatMode, speakerImgIdx]);

  // Helper: start audio monitoring + animation
  const startMonitoring = useCallback(() => {
    if (monitoringActiveRef.current) {
      return;
    }
    monitoringActiveRef.current = true;

    startAudioLevelMonitoring().then(ok => {
      if (!monitoringActiveRef.current) {
        return;
      }
      if (ok) {
        listenerRemoverRef.current = addAudioLevelListener(event => {
          if (typeof event.volume === 'number') {
            systemVolumeRef.current = Math.max(0, Math.min(1, event.volume));
          }
          if (event.levels && event.levels.length >= NUM_COLS) {
            rawTargetsRef.current = event.levels
              .slice(0, NUM_COLS)
              .map(v => Math.max(0, Math.min(1, v)));
          } else if (event.levels) {
            const padded = new Array(NUM_COLS).fill(0);
            event.levels.forEach((v, i) => {
              padded[i] = v;
            });
            rawTargetsRef.current = padded.map(v => Math.max(0, Math.min(1, v)));
          }
        });
      }
      // 不使用模拟数据，原生监听失败时灯柱保持静止
    });
  }, []);

  // Helper: stop audio monitoring
  const stopMonitoring = useCallback(() => {
    if (!monitoringActiveRef.current) {
      return;
    }
    monitoringActiveRef.current = false;
    if (listenerRemoverRef.current) {
      listenerRemoverRef.current();
      listenerRemoverRef.current = null;
    }
    stopAudioLevelMonitoring();
    rawTargetsRef.current = new Array(NUM_COLS).fill(0);
  }, []);

  // Start/stop monitoring on mount/unmount
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);

  // Animation loop – smooth interpolation with peak hold
  const startAnimLoop = useCallback(() => {
    const animate = () => {
      if (!appActiveRef.current) {
        return;
      }

      const curr = currentRef.current;
      const gain = 1;
      const targets = rawTargetsRef.current.map(v => Math.min(1, Math.max(0, v * gain)));
      const peaks = peaksRef.current;

      const newLevels = curr.map((c, i) => {
        const t = targets[i];
        const speed = t > c ? 0.3 : 0.08;
        return c + (t - c) * speed;
      });

      const newPeaks = peaks.map((p, i) =>
        newLevels[i] >= p ? newLevels[i] : Math.max(0, p - 0.012),
      );

      currentRef.current = newLevels;
      peaksRef.current = newPeaks;

      // Beat detection via spectral flux (frame-to-frame energy increase)
      const rawLowEnergy = targets.slice(0, 6).reduce((s, v) => s + v, 0) / 6;
      const flux = Math.max(0, rawLowEnergy - prevEnergyRef.current);
      prevEnergyRef.current = rawLowEnergy;

      const fluxHist = fluxHistoryRef.current;
      fluxHist.push(flux);
      if (fluxHist.length > 40) {
        fluxHist.shift();
      }
      const avgFlux = fluxHist.reduce((s, v) => s + v, 0) / fluxHist.length;

      if (flux > avgFlux * 1.5 && flux > 0.015) {
        beatLevelRef.current = Math.min(1, rawLowEnergy * 2.5);
      } else {
        beatLevelRef.current = Math.max(0, beatLevelRef.current * 0.9);
      }

      frameRef.current += 1;
      // Android Hermes JIT 需要预热，降频到 ~20fps 避免前 10 秒卡顿
      const skipN = Platform.OS === 'android' ? 3 : 2;
      if (frameRef.current % skipN === 0) {
        setLevels(newLevels.slice());
        setPeakLevels(newPeaks.slice());
        setMotionPhase(prev => (prev + 0.09) % TAU);
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    startAnimLoop();
    return () => cancelAnimationFrame(animRef.current);
  }, [startAnimLoop]);

  // Pause monitoring when app goes to background, resume on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        appActiveRef.current = true;
        startMonitoring();
        // Restart animation loop (it was cancelled on background)
        cancelAnimationFrame(animRef.current);
        startAnimLoop();
      } else if (nextState === 'background') {
        appActiveRef.current = false;
        stopMonitoring();
        cancelAnimationFrame(animRef.current);
      }
    });
    return () => sub.remove();
  }, [startMonitoring, stopMonitoring, startAnimLoop]);

  // When paused, fade targets to zero
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      rawTargetsRef.current = new Array(NUM_COLS).fill(0);
    }
  }, [isPlaying]);

  const overallLevel = useMemo(
    () => levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length),
    [levels],
  );
  const hasAudibleSignal = overallLevel > 0.015;
  const minLevel = useMemo(() => Math.min(...levels), [levels]);
  // 非speaker模式：节律=按节拍缩放频谱形状，音量=原始频谱跟能量走
  const volLevel = useMemo(() => {
    if (!spkBeatMode) {
      return levels;
    } // 音量模式：原始频谱
    // 节律模式：保留各列频谱形状，整体高度跟随节拍脉冲
    const beat = beatLevelRef.current;
    const scale = overallLevel > 0.01 ? beat / overallLevel : 0;
    return levels.map(v => Math.min(1, v * scale));
  }, [spkBeatMode, levels, overallLevel]);
  const volPeak = useMemo(() => {
    if (!spkBeatMode) {
      return peakLevels;
    }
    const beat = beatLevelRef.current;
    const scale = overallLevel > 0.01 ? beat / overallLevel : 0;
    return peakLevels.map(v => Math.min(1, v * scale));
  }, [spkBeatMode, peakLevels, overallLevel]);

  const speakerBarLevel = useMemo(() => {
    if (spkBeatMode) return beatLevelRef.current;
    if (levels.length >= 2) {
      const sorted = [...levels].sort((a, b) => b - a);
      return sorted[1];
    }
    return minLevel;
  }, [spkBeatMode, levels, minLevel]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerSide}
          hitSlop={12}>
          <Icon name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('rhythmLight.title')}</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.gridWrap}>
        {mode === 'classic' ? <ClassicLED levels={volLevel} peakLevels={volPeak} /> : null}
        {mode === 'mirror' ? (
          <MirrorWave levels={volLevel} hasAudibleSignal={hasAudibleSignal} />
        ) : null}
        {mode === 'speaker' ? (
          <SpeakerView
            barLevel={speakerBarLevel}
            speakerImgIdx={speakerImgIdx}
            onSpeakerPress={() => setSpeakerImgIdx(prev => (prev + 1) % SPEAKER_IMAGES.length)}
          />
        ) : null}
        {mode === 'matrix' ? <MatrixGrid levels={volLevel} /> : null}
        {mode === 'vumeter' ? <VUMeter levels={volLevel} beatLevel={beatLevelRef.current} /> : null}
        {mode === 'waveform' ? (
          <WaveformView levels={volLevel} beatLevel={beatLevelRef.current} />
        ) : null}
      </View>

      <View style={styles.bottomPanel}>
        <TouchableOpacity
          style={styles.beatSwitchRow}
          activeOpacity={0.7}
          onPress={() => setSpkBeatMode(prev => !prev)}>
          <Text style={styles.beatSwitchLabel}>
            {spkBeatMode ? t('rhythmLight.rhythmMode') : t('rhythmLight.volumeMode')}
          </Text>
          <View style={[styles.beatSwitchTrack, spkBeatMode && styles.beatSwitchTrackOn]}>
            <View style={[styles.beatSwitchThumb, spkBeatMode && styles.beatSwitchThumbOn]} />
          </View>
        </TouchableOpacity>
        <View style={styles.modePanelStrip}>
          {VISUALIZER_MODES.map(item => {
            const selected = mode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                onPress={() => setMode(item.key)}
                style={styles.modePanelItem}>
                <View style={[styles.modePanelIcon, selected && styles.modePanelIconActive]}>
                  <Icon
                    name={item.icon}
                    size={20}
                    color={selected ? '#00E5FF' : 'rgba(255,255,255,0.4)'}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.modePanelText, selected && styles.modePanelTextActive]}>
                  {t(item.labelKey)}
                </Text>
                {selected && <View style={styles.modePanelDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Current track info */}
      {currentTrack && (
        <View style={styles.trackBar}>
          <CoverArt artwork={currentTrack.artwork} size={46} borderRadius={8} />
          <View style={styles.trackText}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>

          <View style={styles.transportInline}>
            <TouchableOpacity style={styles.transportBtn} onPress={skipToPrevious} hitSlop={10}>
              <Icon name="play-skip-back" size={20} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.transportBtn, styles.transportBtnPrimary]}
              onPress={togglePlayPause}
              hitSlop={10}>
              <Icon name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.transportBtn} onPress={skipToNext} hitSlop={10}>
              <Icon name="play-skip-forward" size={20} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  headerSide: { width: 44, alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  gridWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: GRID_H_PAD,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 8,
  },
  modePanelStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(8,14,20,0.88)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  modePanelItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  modePanelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  modePanelIconActive: {
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderColor: 'rgba(0,229,255,0.45)',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  modePanelText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  modePanelTextActive: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  modePanelDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    marginTop: -2,
  },
  beatSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 8,
    height: 28,
  },
  beatSwitchLabel: {
    fontSize: 11,
    color: 'rgba(0,229,255,0.6)',
    fontWeight: '600',
    letterSpacing: 2,
  },
  beatSwitchTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  beatSwitchTrackOn: {
    backgroundColor: 'rgba(0,229,255,0.45)',
  },
  beatSwitchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  beatSwitchThumbOn: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
  },

  trackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
    gap: 12,
  },
  trackText: { flex: 1, marginRight: 6 },
  trackTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  trackArtist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  transportInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  transportBtnPrimary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
});

export default memo(RhythmLightScreen);
