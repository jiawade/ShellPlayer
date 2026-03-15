// src/components/LyricsView.tsx
import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPlayer from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSelector } from '../store';
import { usePlayerControls } from '../hooks/usePlayerProgress';
import { useTheme } from '../contexts/ThemeContext';

const DEFAULT_FONT_SIZE = 16;
const DEFAULT_LINE_HEIGHT = 52;
const ACTIVE_FONT_BOOST = 6;

const LyricsView: React.FC = () => {
  const { lyrics, currentLyricIndex } = useAppSelector(s => s.music);
  const { seekToPrevLyric, seekToNextLyric, replayCurrentLyric } = usePlayerControls();
  const { colors, sizes } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [scrollAreaHeight, setScrollAreaHeight] = useState(400);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [lineH, setLineH] = useState(DEFAULT_LINE_HEIGHT);

  const centerOffset = scrollAreaHeight / 2 - lineH / 2;

  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem('@lyricSettings');
        if (data) {
          const s = JSON.parse(data);
          if (s.fontSize) setFontSize(s.fontSize);
          if (s.lineHeight) setLineH(s.lineHeight);
        }
      } catch {}
    })();
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [dragLineIndex, setDragLineIndex] = useState(-1);
  const autoReturnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForSeek = useRef(false);
  const seekTargetIndex = useRef(-1);

  const onScrollAreaLayout = useCallback((e: LayoutChangeEvent) => {
    setScrollAreaHeight(e.nativeEvent.layout.height);
  }, []);

  useEffect(() => {
    if (isDragging || waitingForSeek.current) {
      if (waitingForSeek.current && currentLyricIndex >= 0) {
        const target = seekTargetIndex.current;
        if (currentLyricIndex === target || Math.abs(currentLyricIndex - target) <= 1) {
          waitingForSeek.current = false; seekTargetIndex.current = -1;
          setIsDragging(false); setDragLineIndex(-1);
        }
      }
      return;
    }
    if (currentLyricIndex >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, currentLyricIndex * lineH), animated: true });
    }
  }, [currentLyricIndex, isDragging, lineH]);

  useEffect(() => { return () => { if (autoReturnTimer.current) clearTimeout(autoReturnTimer.current); }; }, []);

  const clearAutoReturn = useCallback(() => {
    if (autoReturnTimer.current) { clearTimeout(autoReturnTimer.current); autoReturnTimer.current = null; }
  }, []);

  const startAutoReturn = useCallback(() => {
    clearAutoReturn();
    autoReturnTimer.current = setTimeout(() => {
      setIsDragging(false); setDragLineIndex(-1);
      if (currentLyricIndex >= 0 && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, currentLyricIndex * lineH), animated: true });
      }
    }, 2000);
  }, [clearAutoReturn, currentLyricIndex, lineH]);

  const onScrollBeginDrag = useCallback(() => {
    setIsDragging(true); waitingForSeek.current = false; clearAutoReturn();
  }, [clearAutoReturn]);

  const onScrollEndDrag = useCallback(() => { startAutoReturn(); }, [startAutoReturn]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isDragging) return;
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / lineH);
    const clamped = Math.max(0, Math.min(lyrics.length - 1, idx));
    if (clamped !== dragLineIndex) setDragLineIndex(clamped);
  }, [isDragging, lyrics.length, dragLineIndex, lineH]);

  const handleSeekToDragLine = useCallback(async () => {
    clearAutoReturn();
    if (dragLineIndex >= 0 && dragLineIndex < lyrics.length) {
      waitingForSeek.current = true; seekTargetIndex.current = dragLineIndex;
      await TrackPlayer.seekTo(lyrics[dragLineIndex].time);
      await TrackPlayer.play();
      setDragLineIndex(-1);
      setTimeout(() => { if (waitingForSeek.current) { waitingForSeek.current = false; seekTargetIndex.current = -1; setIsDragging(false); } }, 1000);
    }
  }, [dragLineIndex, lyrics, clearAutoReturn]);

  if (lyrics.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="musical-notes-outline" size={64} color={colors.textMuted} />
        <Text style={{ fontSize: sizes.xl, color: colors.textSecondary, marginTop: 16, fontWeight: '600' }}>暂无歌词</Text>
        <Text style={{ fontSize: sizes.md, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>支持 .lrc 文件或 ID3 内嵌歌词{'\n'}.lrc 文件需与歌曲同名同目录</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.scrollArea} onLayout={onScrollAreaLayout}>
        <ScrollView
          ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={onScrollBeginDrag} onScrollEndDrag={onScrollEndDrag}
          onScroll={onScroll} scrollEventThrottle={16}>
          <View style={{ height: centerOffset }} />
          {lyrics.map((line, i) => {
            const isActive = !isDragging && !waitingForSeek.current && i === currentLyricIndex;
            const isDragTarget = isDragging && i === dragLineIndex;
            const isPast = !isDragging && !waitingForSeek.current && i < currentLyricIndex;
            return (
              <View key={`${i}-${line.time}`}
                style={[{ minHeight: lineH }, styles.line,
                  isActive && { backgroundColor: 'rgba(0, 229, 195, 0.1)' },
                  isDragTarget && { backgroundColor: 'rgba(0, 229, 195, 0.15)' },
                ]}>
                <Text style={[
                  { fontSize, lineHeight: fontSize * 1.8, color: colors.textMuted, textAlign: 'center', fontWeight: '400' },
                  isActive && { color: colors.accent, fontWeight: '700', fontSize: fontSize + ACTIVE_FONT_BOOST, lineHeight: (fontSize + ACTIVE_FONT_BOOST) * 1.6, textShadowColor: colors.accentGlow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
                  isDragTarget && { color: colors.white, fontWeight: '600', fontSize: fontSize + 4, lineHeight: (fontSize + 4) * 1.6 },
                  isPast && { color: colors.textSecondary, opacity: 0.7 },
                ]}>{line.text}</Text>
              </View>
            );
          })}
          <View style={{ height: centerOffset }} />
        </ScrollView>

        {isDragging && dragLineIndex >= 0 && (
          <View style={[styles.seekOverlay, { top: centerOffset + lineH / 2 - 1 }]} pointerEvents="box-none">
            <View style={styles.seekLineRow}>
              <View style={[styles.seekLine, { backgroundColor: colors.accent }]} />
              <TouchableOpacity style={[styles.seekPlayBtn, { backgroundColor: colors.accent }]} onPress={handleSeekToDragLine} activeOpacity={0.7}>
                <Icon name="play" size={16} color={colors.bg} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.seekTimeText, { color: colors.accent }]}>{fmt(lyrics[dragLineIndex]?.time || 0)}</Text>
          </View>
        )}
      </View>

      <View style={[styles.ctrlBar, { backgroundColor: colors.bgGlass, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={seekToPrevLyric} style={[styles.ctrlBtn, { backgroundColor: colors.accentDim }]} activeOpacity={0.6}>
          <Icon name="play-back" size={18} color={colors.accent} /><Text style={{ fontSize: sizes.sm, color: colors.accent, fontWeight: '600' }}>上一句</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={replayCurrentLyric} style={[styles.ctrlBtn, styles.replayBtn, { backgroundColor: colors.accent }]} activeOpacity={0.6}>
          <Icon name="refresh" size={20} color={colors.bg} /><Text style={{ fontSize: sizes.sm, color: colors.bg, fontWeight: '600' }}>重播</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={seekToNextLyric} style={[styles.ctrlBtn, { backgroundColor: colors.accentDim }]} activeOpacity={0.6}>
          <Icon name="play-forward" size={18} color={colors.accent} /><Text style={{ fontSize: sizes.sm, color: colors.accent, fontWeight: '600' }}>下一句</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function fmt(s: number): string {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollArea: { flex: 1, position: 'relative' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  line: { justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  seekOverlay: { position: 'absolute', left: 0, right: 0, alignItems: 'flex-end', paddingHorizontal: 12 },
  seekLineRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  seekLine: { flex: 1, height: 1.5, opacity: 0.5 },
  seekPlayBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 8, elevation: 4 },
  seekTimeText: { fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 4, marginRight: 42, opacity: 0.8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  ctrlBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, gap: 20, borderTopWidth: 1 },
  ctrlBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  replayBtn: { paddingHorizontal: 20, paddingVertical: 10 },
});

export default memo(LyricsView);
