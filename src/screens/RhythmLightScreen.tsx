// src/screens/RhythmLightScreen.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  AppState,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useNavigation} from '@react-navigation/native';
import {useAppSelector} from '../store';
import {usePlayerControls} from '../hooks/usePlayerProgress';
import CoverArt from '../components/CoverArt';
import {
  startAudioLevelMonitoring,
  stopAudioLevelMonitoring,
  addAudioLevelListener,
} from '../utils/audioLevel';
import AsyncStorage from '@react-native-async-storage/async-storage';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SPEAKER_IMAGES = [
  require('../assets/fg2.jpeg'),
  require('../assets/fg4.jpeg'),
];

const NUM_COLS = 16;
const NUM_ROWS = 28;
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const GRID_H_PAD = 20;
const COL_GAP = 3;
const ROW_GAP = 2;
const CELL_W = Math.floor((SCREEN_W - GRID_H_PAD * 2 - COL_GAP * (NUM_COLS - 1)) / NUM_COLS);
const LED_TARGET_H = Math.max(320, Math.floor(SCREEN_H * 0.56));
const BASE_CELL_H = Math.floor((LED_TARGET_H - ROW_GAP * (NUM_ROWS - 1)) / NUM_ROWS);
const CELL_H = Math.max(9, Math.min(16, BASE_CELL_H));

const COLS_ARR = Array.from({length: NUM_COLS}, (_, i) => i);
const ROWS_ARR = Array.from({length: NUM_ROWS}, (_, i) => i);
const TAU = Math.PI * 2;
const RHYTHM_PREFS_KEY = '@rhythmLightPrefs';

type VisualizerMode = 'classic' | 'mirror' | 'speaker' | 'particles' | 'neon' | 'matrix';

const VISUALIZER_MODES: Array<{key: VisualizerMode; label: string; icon: string}> = [
  {key: 'classic', label: '经典灯柱', icon: 'apps-outline'},
  {key: 'mirror', label: '中轴波形', icon: 'swap-vertical-outline'},
  {key: 'speaker', label: '音响节律', icon: 'volume-high-outline'},
  {key: 'neon', label: '霓虹曲线', icon: 'pulse-outline'},
  {key: 'matrix', label: '流光方阵', icon: 'grid-outline'},
];

/** LED color gradient: green (bottom) → yellow → orange → red (top) */
const getCellColor = (rowFromBottom: number): string => {
  const ratio = rowFromBottom / NUM_ROWS;
  if (ratio <= 0.3) {
    return '#00FF44';
  }
  if (ratio <= 0.5) {
    return '#55FF00';
  }
  if (ratio <= 0.65) {
    return '#AAFF00';
  }
  if (ratio <= 0.78) {
    return '#FFD700';
  }
  if (ratio <= 0.88) {
    return '#FF8C00';
  }
  if (ratio <= 0.94) {
    return '#FF4500';
  }
  return '#FF0000';
};

const DIM_COLOR = 'rgba(40, 40, 40, 0.3)';

const getMatrixColor = (rowFromBottom: number): string => {
  const ratio = rowFromBottom / NUM_ROWS;
  if (ratio <= 0.3) {
    return '#00E5FF';
  }
  if (ratio <= 0.55) {
    return '#00B8FF';
  }
  if (ratio <= 0.8) {
    return '#5A8CFF';
  }
  return '#8B5CFF';
};

const RhythmLightScreen: React.FC = () => {
  const navigation = useNavigation();
  const {currentTrack, isPlaying} = useAppSelector(s => s.music);
  const {togglePlayPause, skipToNext, skipToPrevious} = usePlayerControls();
  const [levels, setLevels] = useState<number[]>(() => new Array(NUM_COLS).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(NUM_COLS).fill(0));
  const [mode, setMode] = useState<VisualizerMode>('classic');
  const [speakerImgIdx, setSpeakerImgIdx] = useState(() => Math.floor(Math.random() * SPEAKER_IMAGES.length));
  const [motionPhase, setMotionPhase] = useState(0);
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
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const useNativeRef = useRef(false);
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
        if (!raw || cancelled) return;
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
          const safeIdx = Math.max(0, Math.min(SPEAKER_IMAGES.length - 1, Math.floor(parsed.speakerImgIdx)));
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
      JSON.stringify({mode, spkBeatMode, speakerImgIdx}),
    ).catch(() => {});
  }, [mode, spkBeatMode, speakerImgIdx]);

  // Helper: start audio monitoring + animation
  const startMonitoring = useCallback(() => {
    if (monitoringActiveRef.current) return;
    monitoringActiveRef.current = true;

    startAudioLevelMonitoring().then(ok => {
      if (!monitoringActiveRef.current) return; // stopped while awaiting
      useNativeRef.current = ok;
      if (ok) {
        listenerRemoverRef.current = addAudioLevelListener(event => {
          // 记录系统音量
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
      } else {
        simIntervalRef.current = setInterval(() => {
          if (isPlayingRef.current) {
            rawTargetsRef.current = Array.from({length: NUM_COLS}, () => Math.random() * 0.6 + 0.1);
          }
        }, 80);
      }
    });
  }, []);

  // Helper: stop audio monitoring
  const stopMonitoring = useCallback(() => {
    if (!monitoringActiveRef.current) return;
    monitoringActiveRef.current = false;
    if (listenerRemoverRef.current) {
      listenerRemoverRef.current();
      listenerRemoverRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
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
      if (!appActiveRef.current) return;

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
      if (fluxHist.length > 40) fluxHist.shift();
      const avgFlux = fluxHist.reduce((s, v) => s + v, 0) / fluxHist.length;

      if (flux > avgFlux * 1.5 && flux > 0.015) {
        beatLevelRef.current = Math.min(1, rawLowEnergy * 2.5);
      } else {
        beatLevelRef.current = Math.max(0, beatLevelRef.current * 0.9);
      }

      frameRef.current += 1;
      if (frameRef.current % 2 === 0) {
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
    const sub = AppState.addEventListener('change', (nextState) => {
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
    if (!spkBeatMode) return levels; // 音量模式：原始频谱
    // 节律模式：保留各列频谱形状，整体高度跟随节拍脉冲
    const beat = beatLevelRef.current;
    const scale = overallLevel > 0.01 ? beat / overallLevel : 0;
    return levels.map(v => Math.min(1, v * scale));
  }, [spkBeatMode, levels, overallLevel]);
  const volPeak = useMemo(() => {
    if (!spkBeatMode) return peakLevels;
    const beat = beatLevelRef.current;
    const scale = overallLevel > 0.01 ? beat / overallLevel : 0;
    return peakLevels.map(v => Math.min(1, v * scale));
  }, [spkBeatMode, peakLevels, overallLevel]);

  const renderClassic = () => (
    <View style={styles.grid}>
      {COLS_ARR.map(colIdx => {
        const level = volLevel[colIdx] || 0;
        const peak = volPeak[colIdx] || 0;
        const litCount = Math.max(1, Math.round(level * NUM_ROWS));
        const peakRow = Math.min(Math.round(peak * NUM_ROWS), NUM_ROWS - 1);
        return (
          <View key={colIdx} style={styles.column}>
            {ROWS_ARR.map(rowIdx => {
              const fromBottom = NUM_ROWS - 1 - rowIdx;
              const isLit = fromBottom < litCount;
              const isPeak = fromBottom === peakRow && peakRow > 0;
              return (
                <View
                  key={rowIdx}
                  style={[
                    styles.cell,
                    {backgroundColor: isLit || isPeak ? getCellColor(fromBottom) : DIM_COLOR},
                  ]}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );

  const renderMirror = () => {
    const mirrorHeight = Math.min(LED_TARGET_H, Math.floor(SCREEN_H * 0.52));
    const halfHeight = Math.floor(mirrorHeight / 2);

    return (
      <View style={[styles.mirrorWrap, {height: mirrorHeight}]}>
        {COLS_ARR.map(i => {
          const lv = volLevel[i] || 0;
          const barH = hasAudibleSignal ? Math.max(0, Math.round(lv * (halfHeight - 6))) : 2;
          const alpha = 0.25 + lv * 0.75;
          return (
            <View key={i} style={styles.mirrorCol}>
              <View style={styles.mirrorCenterLine} />
              <View
                style={[styles.mirrorBar, styles.mirrorBarTop, {height: barH, opacity: alpha}]}
              />
              <View
                style={[styles.mirrorBar, styles.mirrorBarBottom, {height: barH, opacity: alpha}]}
              />
            </View>
          );
        })}
      </View>
    );
  };

  // ---- Speaker + LED Bars effect ----
  const SPKR_BAR_ROWS = 48;
  const SPKR_BAR_ROWS_ARR = Array.from({length: SPKR_BAR_ROWS}, (_, i) => i);

  const getBarCellColor = (rowFromBottom: number): string => {
    const ratio = rowFromBottom / SPKR_BAR_ROWS;
    if (ratio <= 0.28) return '#00FF44';
    if (ratio <= 0.46) return '#55FF00';
    if (ratio <= 0.60) return '#AAFF00';
    if (ratio <= 0.73) return '#FFD700';
    if (ratio <= 0.84) return '#FF8C00';
    if (ratio <= 0.92) return '#FF4500';
    return '#FF0000';
  };

  const renderSpeaker = () => {
    const areaW = SCREEN_W - 24;
    const areaH = Math.min(LED_TARGET_H, Math.floor(SCREEN_H * 0.52));
    let barLevel: number;
    if (spkBeatMode) {
      // 节律模式保持原逻辑
      barLevel = beatLevelRef.current;
    } else {
      // 音量模式改为使用经典灯柱最低值，不再关联系统音量
      barLevel = minLevel;
    }

    const barW = 14;
    const barGap = 6;
    const barGroupW = barW * 2 + barGap;
    const speakerAreaW = areaW - barGroupW * 2 - 24;
    const barH = Math.min(areaH - 16, 340);
    const cellH = Math.max(1, Math.floor((barH - ROW_GAP * (SPKR_BAR_ROWS - 1)) / SPKR_BAR_ROWS));

    const litCount = Math.max(1, Math.round(barLevel * SPKR_BAR_ROWS));

    const renderBar = (keyPrefix: string) => (
      <View style={{gap: barGap, flexDirection: 'row'}}>
        {[0, 1].map(bi => (
          <View key={`${keyPrefix}-${bi}`} style={{gap: ROW_GAP}}>
            {SPKR_BAR_ROWS_ARR.map(rowIdx => {
              const fromBottom = SPKR_BAR_ROWS - 1 - rowIdx;
              const isLit = fromBottom < litCount;
              return (
                <View
                  key={rowIdx}
                  style={{
                    width: barW,
                    height: cellH,
                    borderRadius: 2,
                    backgroundColor: isLit ? getBarCellColor(fromBottom) : 'rgba(40,40,40,0.35)',
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    );

    return (
      <View style={{width: areaW, height: areaH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12}}>
        {/* Left bars */}
        {renderBar('L')}

        {/* Center: speaker image */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setSpeakerImgIdx(prev => (prev + 1) % SPEAKER_IMAGES.length)}
          style={{
          flex: 1,
          height: barH,
          backgroundColor: '#0a0a0a',
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: '#2a2a2a',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.8,
          shadowRadius: 12,
        }}>
          <Image
            source={SPEAKER_IMAGES[speakerImgIdx]}
            style={{
              width: speakerAreaW,
              height: barH,
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>

        {/* Right bars */}
        {renderBar('R')}
      </View>
    );
  };

  const renderNeon = () => {
    const lineWidth = SCREEN_W - GRID_H_PAD * 2;
    const lineHeight = Math.min(LED_TARGET_H, Math.floor(SCREEN_H * 0.5));
    const points = COLS_ARR.map(i => {
      const left = (i / (NUM_COLS - 1)) * lineWidth;
      const curr = volLevel[i] || 0;
      const prev = volLevel[Math.max(0, i - 1)] || 0;
      const next = volLevel[Math.min(NUM_COLS - 1, i + 1)] || 0;
      const smooth = (prev + curr * 2 + next) / 4;
      const top = lineHeight * (0.9 - smooth * 0.82);
      return {left, top};
    });

    return (
      <View style={[styles.neonWrap, {width: lineWidth, height: lineHeight}]}>
        {points.slice(0, -1).map((p1, i) => {
              const p2 = points[i + 1];
              const dx = p2.left - p1.left;
              const dy = p2.top - p1.top;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              return (
                <View
                  key={i}
                  style={[
                    styles.neonSegment,
                    {
                      left: p1.left,
                      top: p1.top,
                      width: len,
                      transform: [{rotate: `${angle}deg`}],
                      opacity: 0.36 + (volLevel[i] || 0) * 0.64,
                    },
                  ]}
                />
              );
            })}

        {points.map((p, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.neonDot,
                  {
                    left: p.left - 2,
                    top: p.top - 2,
                    opacity: 0.45 + (volLevel[i] || 0) * 0.55,
                  },
                ]}
              />
            ))}
      </View>
    );
  };

  const renderMatrix = () => (
    <View style={styles.grid}>
      {COLS_ARR.map(colIdx => {
        const level = volLevel[colIdx] || 0;
        const litCount = Math.max(1, Math.round(level * NUM_ROWS));
        return (
          <View key={colIdx} style={styles.column}>
            {ROWS_ARR.map(rowIdx => {
              const fromBottom = NUM_ROWS - 1 - rowIdx;
              const isLit = fromBottom < litCount;
              const matrixCellStyle = isLit
                ? {backgroundColor: getMatrixColor(fromBottom), opacity: 0.25 + (level || 0) * 0.75}
                : styles.matrixCellDim;
              return <View key={rowIdx} style={[styles.cell, matrixCellStyle]} />;
            })}
          </View>
        );
      })}
    </View>
  );

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
        <Text style={styles.headerTitle}>律动灯</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.gridWrap}>
        {mode === 'classic' ? renderClassic() : null}
        {mode === 'mirror' ? renderMirror() : null}
        {mode === 'speaker' ? renderSpeaker() : null}
        {mode === 'neon' ? renderNeon() : null}
        {mode === 'matrix' ? renderMatrix() : null}
      </View>

      <View style={styles.bottomPanel}>
        <TouchableOpacity
          style={styles.beatSwitchRow}
          activeOpacity={0.7}
          onPress={() => setSpkBeatMode(prev => !prev)}>
          <Text style={styles.beatSwitchLabel}>
            {spkBeatMode ? '节律模式' : '音量模式'}
          </Text>
          <View style={[styles.beatSwitchTrack, spkBeatMode && styles.beatSwitchTrackOn]}>
            <View style={[styles.beatSwitchThumb, spkBeatMode && styles.beatSwitchThumbOn]} />
          </View>
        </TouchableOpacity>
        <View style={styles.modeRowBottom}>
          {VISUALIZER_MODES.map(item => {
            const selected = mode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.85}
                onPress={() => setMode(item.key)}
                style={[styles.modeChipBottom, selected && styles.modeChipBottomActive]}>
                <Icon
                  name={item.icon}
                  size={18}
                  color={selected ? '#fff' : 'rgba(255,255,255,0.72)'}
                  style={styles.modeChipIcon}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.modeChipBottomText, selected && styles.modeChipBottomTextActive]}>
                  {item.label}
                </Text>
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
  root: {flex: 1, backgroundColor: '#000'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  headerSide: {width: 44, alignItems: 'center'},
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
  grid: {flexDirection: 'row', gap: COL_GAP},
  column: {gap: ROW_GAP},
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderRadius: 2,
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    gap: 8,
  },
  modeRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modeChipBottom: {
    flex: 1,
    minWidth: 0,
    height: 62,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  modeChipBottomActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modeChipIcon: {
    marginBottom: 3,
  },
  modeChipBottomText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  modeChipBottomTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  beatSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 4,
    height: 28,
  },
  beatSwitchLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
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
    backgroundColor: 'rgba(0,255,68,0.5)',
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
  mirrorWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: COL_GAP,
  },
  mirrorCol: {
    width: CELL_W,
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrorCenterLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mirrorBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 3,
    backgroundColor: '#53FFAF',
  },
  mirrorBarTop: {
    bottom: '50%',
  },
  mirrorBarBottom: {
    top: '50%',
  },
  radialWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialRing: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: 'rgba(90,255,220,0.9)',
    backgroundColor: 'rgba(90,255,220,0.05)',
  },
  radialCenterCover: {
    width: 98,
    height: 98,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#6EFFE0',
    shadowColor: '#6EFFE0',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
  neonWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  neonSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#2FE8FF',
    shadowColor: '#2FE8FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.85,
    shadowRadius: 4,
  },
  neonDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C7F8FF',
    shadowColor: '#2FE8FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  matrixCellDim: {
    backgroundColor: 'rgba(25,25,36,0.22)',
  },

  trackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
    gap: 12,
  },
  trackText: {flex: 1, marginRight: 6},
  trackTitle: {fontSize: 15, fontWeight: '600', color: '#fff'},
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
