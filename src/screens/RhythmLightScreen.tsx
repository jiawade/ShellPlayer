// src/screens/RhythmLightScreen.tsx
import React, {memo, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  PanResponder,
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

type VisualizerMode = 'classic' | 'mirror' | 'radial' | 'particles' | 'neon' | 'matrix';

const VISUALIZER_MODES: Array<{key: VisualizerMode; label: string}> = [
  {key: 'classic', label: '经典灯柱'},
  {key: 'mirror', label: '中轴波形'},
  {key: 'radial', label: '圆环脉冲'},
  {key: 'particles', label: '粒子光效'},
  {key: 'neon', label: '霓虹曲线'},
  {key: 'matrix', label: '流光方阵'},
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
  const [sensitivity, setSensitivity] = useState(0.45);
  const [mode, setMode] = useState<VisualizerMode>('classic');
  const [motionPhase, setMotionPhase] = useState(0);

  const rawTargetsRef = useRef(new Array(NUM_COLS).fill(0));
  const currentRef = useRef(new Array(NUM_COLS).fill(0));
  const peaksRef = useRef(new Array(NUM_COLS).fill(0));
  const animRef = useRef(0);
  const frameRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const sensitivityRef = useRef(0.45);
  const sliderTrackWidthRef = useRef(1);

  const setSensitivityValue = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    sensitivityRef.current = clamped;
    setSensitivity(clamped);
  };

  const updateSensitivityByX = (x: number) => {
    const width = Math.max(1, sliderTrackWidthRef.current);
    setSensitivityValue(x / width);
  };

  const sensitivityResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        updateSensitivityByX(evt.nativeEvent.locationX);
      },
      onPanResponderMove: evt => {
        updateSensitivityByX(evt.nativeEvent.locationX);
      },
    }),
  ).current;

  // Subscribe to real audio levels from native module (with simulation fallback)
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    let simInterval: ReturnType<typeof setInterval> | null = null;

    startAudioLevelMonitoring().then(ok => {
      if (ok) {
        // Real native audio data
        removeListener = addAudioLevelListener(event => {
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
        // Fallback: simulation based on isPlaying
        simInterval = setInterval(() => {
          if (isPlayingRef.current) {
            rawTargetsRef.current = Array.from({length: NUM_COLS}, () => Math.random() * 0.6 + 0.1);
          }
        }, 80);
      }
    });

    return () => {
      if (removeListener) {
        removeListener();
      }
      if (simInterval) {
        clearInterval(simInterval);
      }
      stopAudioLevelMonitoring();
    };
  }, []);

  // When paused, fade targets to zero
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      rawTargetsRef.current = new Array(NUM_COLS).fill(0);
    }
  }, [isPlaying]);

  // Animation loop – smooth interpolation with peak hold
  useEffect(() => {
    const animate = () => {
      const curr = currentRef.current;
      const gain = 1 + sensitivityRef.current * 39;
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

      frameRef.current += 1;
      if (frameRef.current % 2 === 0) {
        setLevels(newLevels.slice());
        setPeakLevels(newPeaks.slice());
        setMotionPhase(prev => (prev + 0.09) % TAU);
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const overallLevel = useMemo(
    () => levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length),
    [levels],
  );
  const hasAudibleSignal = overallLevel > 0.015;

  const renderClassic = () => (
    <View style={styles.grid}>
      {COLS_ARR.map(colIdx => {
        const level = levels[colIdx] || 0;
        const peak = peakLevels[colIdx] || 0;
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
          const lv = levels[i] || 0;
          const barH = hasAudibleSignal ? Math.max(0, Math.round(lv * (halfHeight - 6))) : 0;
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

  const renderRadial = () => {
    const baseSize = Math.min(Math.floor(SCREEN_W * 0.62), Math.floor(LED_TARGET_H * 0.62));
    const pulse = isPlaying ? overallLevel : 0;
    const breathing = 0.04 + 0.04 * (Math.sin(motionPhase) + 1);
    const idleOpacity = isPlaying && !hasAudibleSignal ? 0.14 + breathing : 0.08;
    const ringAlpha = hasAudibleSignal ? 0.2 + pulse * 0.75 : idleOpacity;

    return (
      <View style={[styles.radialWrap, {width: baseSize, height: baseSize}]}>
        <View
          style={[
            styles.radialRing,
            {
              width: baseSize,
              height: baseSize,
              borderRadius: baseSize / 2,
              opacity: ringAlpha,
              transform: [{scale: 1 + pulse * 0.55 + breathing * 0.18}],
            },
          ]}
        />
        <View
          style={[
            styles.radialRing,
            {
              width: baseSize * 0.78,
              height: baseSize * 0.78,
              borderRadius: (baseSize * 0.78) / 2,
              opacity: ringAlpha * 0.8,
              transform: [{scale: 1 + pulse * 0.38 + breathing * 0.24}],
            },
          ]}
        />
        <View
          style={[
            styles.radialRing,
            {
              width: baseSize * 0.56,
              height: baseSize * 0.56,
              borderRadius: (baseSize * 0.56) / 2,
              opacity: ringAlpha * 0.9,
              transform: [{scale: 1 + pulse * 0.2 + breathing * 0.28}],
            },
          ]}
        />

        <View style={styles.radialCenterCover}>
          {currentTrack ? (
            <CoverArt artwork={currentTrack.artwork} size={84} borderRadius={14} />
          ) : (
            <Icon name="musical-notes" size={40} color="rgba(255,255,255,0.72)" />
          )}
        </View>
      </View>
    );
  };

  const renderParticles = () => {
    const pWidth = SCREEN_W - GRID_H_PAD * 2;
    const pHeight = Math.min(LED_TARGET_H, Math.floor(SCREEN_H * 0.5));
    const particleCount = hasAudibleSignal ? Math.min(84, Math.floor(10 + overallLevel * 110)) : 0;

    return (
      <View style={[styles.particleWrap, {width: pWidth, height: pHeight}]}>
        {Array.from({length: particleCount}, (_, idx) => {
          const lane = idx % NUM_COLS;
          const lv = levels[lane] || 0;
          if (lv <= 0.01) {
            return null;
          }
          const baseX = ((lane + 0.5) / NUM_COLS) * pWidth;
          const driftX = Math.sin(motionPhase * 1.2 + idx * 0.77) * (2 + lv * 5);
          const speed = 0.35 + lv * 1.9;
          const progress = ((motionPhase * speed + idx * 0.13) % TAU) / TAU;
          const y = pHeight - progress * pHeight;
          const size = 2 + lv * 5;
          const opacity = 0.24 + lv * 0.76;
          return (
            <View
              key={idx}
              style={[
                styles.particle,
                {
                  left: baseX + driftX,
                  top: y,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  opacity,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderNeon = () => {
    const lineWidth = SCREEN_W - GRID_H_PAD * 2;
    const lineHeight = Math.min(LED_TARGET_H, Math.floor(SCREEN_H * 0.5));
    const points = COLS_ARR.map(i => {
      const left = (i / (NUM_COLS - 1)) * lineWidth;
      const curr = levels[i] || 0;
      const prev = levels[Math.max(0, i - 1)] || 0;
      const next = levels[Math.min(NUM_COLS - 1, i + 1)] || 0;
      const smooth = (prev + curr * 2 + next) / 4;
      const top = lineHeight * (0.9 - smooth * 0.82);
      return {left, top};
    });

    return (
      <View style={[styles.neonWrap, {width: lineWidth, height: lineHeight}]}>
        {hasAudibleSignal
          ? points.slice(0, -1).map((p1, i) => {
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
                      opacity: 0.36 + (levels[i] || 0) * 0.64,
                    },
                  ]}
                />
              );
            })
          : null}

        {hasAudibleSignal
          ? points.map((p, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.neonDot,
                  {
                    left: p.left - 2,
                    top: p.top - 2,
                    opacity: 0.45 + (levels[i] || 0) * 0.55,
                  },
                ]}
              />
            ))
          : null}
      </View>
    );
  };

  const renderMatrix = () => (
    <View style={styles.grid}>
      {COLS_ARR.map(colIdx => {
        const level = levels[colIdx] || 0;
        const litCount = hasAudibleSignal ? Math.round(level * NUM_ROWS) : 0;
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

      {/* LED Grid */}
      <View style={styles.sensitivityRow}>
        <Icon name="pulse-outline" size={16} color="rgba(255,255,255,0.7)" />
        <Text style={styles.sensitivityText}>灵敏度</Text>
        <View
          style={styles.sliderTrackWrap}
          onLayout={e => {
            sliderTrackWidthRef.current = e.nativeEvent.layout.width;
          }}
          {...sensitivityResponder.panHandlers}>
          <View style={styles.sliderTrack} />
          <View style={[styles.sliderFill, {width: `${sensitivity * 100}%`}]} />
          <View style={[styles.sliderThumb, {left: `${sensitivity * 100}%`}]} />
        </View>
        <Text style={styles.sensitivityValue}>{(1 + sensitivity * 39).toFixed(1)}x</Text>
      </View>

      <View style={styles.modeRow}>
        {VISUALIZER_MODES.map(item => {
          const selected = mode === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.85}
              onPress={() => setMode(item.key)}
              style={[styles.modeChip, selected && styles.modeChipActive]}>
              <Text style={[styles.modeChipText, selected && styles.modeChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.gridWrap}>
        {mode === 'classic' ? renderClassic() : null}
        {mode === 'mirror' ? renderMirror() : null}
        {mode === 'radial' ? renderRadial() : null}
        {mode === 'particles' ? renderParticles() : null}
        {mode === 'neon' ? renderNeon() : null}
        {mode === 'matrix' ? renderMatrix() : null}

        {!isPlaying && (
          <View style={styles.pauseOverlay}>
            <Icon name="musical-notes-outline" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={styles.pauseHint}>播放音乐以查看律动效果</Text>
          </View>
        )}
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
  sensitivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 4,
  },
  sensitivityText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  sliderTrackWrap: {
    flex: 1,
    height: 26,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  sliderThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    transform: [{translateX: -7}],
  },
  sensitivityValue: {
    width: 38,
    textAlign: 'right',
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 8,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  modeChipActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  modeChipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  modeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  pauseOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pauseHint: {fontSize: 13, color: 'rgba(255,255,255,0.35)'},
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
