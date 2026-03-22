// src/components/LyricsView.tsx
import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent,
  Modal, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import TrackPlayer from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSelector, useAppDispatch } from '../store';
import { setLyrics } from '../store/musicSlice';
import { usePlayerControls } from '../hooks/usePlayerProgress';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { searchLyrics, downloadAndSaveLyrics, LrcSearchResult } from '../utils/lyricsSearch';
import { parseLRC, parseTextLyrics } from '../utils/lrcParser';

const DEFAULT_FONT_SIZE = 16;
const DEFAULT_LINE_HEIGHT = 52;
const ACTIVE_FONT_BOOST = 6;
const OFFSET_STEP = 0.1; // seconds

const LyricsView: React.FC = () => {
  const { lyrics, currentLyricIndex, currentTrack } = useAppSelector(s => s.music);
  const dispatch = useAppDispatch();
  const { seekToPrevLyric, seekToNextLyric, replayCurrentLyric } = usePlayerControls();
  const { colors, sizes } = useTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);

  // Lyrics search state
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LrcSearchResult[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());

  const handleSearchLyrics = useCallback(async () => {
    if (!currentTrack) return;
    setShowSearch(true);
    setSearching(true);
    setSearchResults([]);
    setDownloadedIds(new Set());
    try {
      const results = await searchLyrics(currentTrack.title, currentTrack.artist);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [currentTrack]);

  const handleDownloadLyrics = useCallback(async (result: LrcSearchResult) => {
    if (!currentTrack) return;
    // Determine save path: same directory as source, .lrc extension
    const fp = currentTrack.filePath;
    const dotIdx = fp.lastIndexOf('.');
    const lrcPath = dotIdx > 0 ? fp.substring(0, dotIdx) + '.lrc' : fp + '.lrc';
    const ok = await downloadAndSaveLyrics(result, lrcPath);
    if (ok) {
      setDownloadedIds(prev => new Set(prev).add(result.id));
      // Parse the downloaded lyrics and update display
      const content = result.syncedLyrics ?? result.plainLyrics ?? '';
      let parsed = parseLRC(content);
      if (parsed.length === 0) {
        parsed = parseTextLyrics(content, currentTrack.duration);
      }
      dispatch(setLyrics(parsed));
      setShowSearch(false);
    } else {
      Alert.alert(t('lyrics.search.title'), t('lyrics.search.noResults'));
    }
  }, [currentTrack, dispatch, t]);

  const [scrollAreaHeight, setScrollAreaHeight] = useState(400);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [lineH, setLineH] = useState(DEFAULT_LINE_HEIGHT);
  const [lyricsOffset, setLyricsOffset] = useState(0);
  const [showOffsetBar, setShowOffsetBar] = useState(false);

  const centerOffset = scrollAreaHeight / 2 - lineH / 2;

  // Load lyrics offset per track
  useEffect(() => {
    if (!currentTrack?.id) return;
    (async () => {
      try {
        const val = await AsyncStorage.getItem(`@lyricOffset_${currentTrack.id}`);
        setLyricsOffset(val ? parseFloat(val) : 0);
      } catch {
        setLyricsOffset(0);
      }
    })();
  }, [currentTrack?.id]);

  const adjustOffset = useCallback((delta: number) => {
    setLyricsOffset(prev => {
      const next = Math.round((prev + delta) * 10) / 10;
      if (currentTrack?.id) {
        AsyncStorage.setItem(`@lyricOffset_${currentTrack.id}`, String(next)).catch(() => {});
      }
      return next;
    });
  }, [currentTrack?.id]);

  const resetOffset = useCallback(() => {
    setLyricsOffset(0);
    if (currentTrack?.id) {
      AsyncStorage.removeItem(`@lyricOffset_${currentTrack.id}`).catch(() => {});
    }
  }, [currentTrack?.id]);

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

  const fmtDur = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderSearchModal = () => (
    <Modal visible={showSearch} transparent animationType="slide" onRequestClose={() => setShowSearch(false)}>
      <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowSearch(false)}>
        <Pressable style={[styles.searchSheet, { backgroundColor: colors.bgElevated }]} onPress={() => {}}>
          <View style={styles.searchHeader}>
            <Text style={{ fontSize: sizes.xl, fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{t('lyrics.search.title')}</Text>
            <TouchableOpacity onPress={() => setShowSearch(false)} hitSlop={12}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {currentTrack && (
            <Text style={{ fontSize: sizes.sm, color: colors.textMuted, marginBottom: 12 }} numberOfLines={1}>
              {currentTrack.artist} - {currentTrack.title}
            </Text>
          )}
          {searching ? (
            <View style={styles.searchCenter}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ fontSize: sizes.md, color: colors.textMuted, marginTop: 12 }}>{t('lyrics.search.searching')}</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchCenter}>
              <Icon name="search-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: sizes.md, color: colors.textMuted, marginTop: 12 }}>{t('lyrics.search.noResults')}</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {searchResults.map(r => {
                const isDownloaded = downloadedIds.has(r.id);
                const hasSynced = !!r.syncedLyrics;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.resultItem, { borderBottomColor: colors.border }]}
                    activeOpacity={0.6}
                    onPress={() => !isDownloaded && handleDownloadLyrics(r)}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '600' }} numberOfLines={1}>{r.title}</Text>
                      <Text style={{ fontSize: sizes.sm, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{r.artist}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {r.album ? <Text style={{ fontSize: sizes.xs, color: colors.textMuted }} numberOfLines={1}>{r.album}</Text> : null}
                        <Text style={{ fontSize: sizes.xs, color: colors.textMuted }}>{fmtDur(r.duration)}</Text>
                        <View style={[styles.badge, { backgroundColor: hasSynced ? colors.accent : colors.bgCard }]}>
                          <Text style={{ fontSize: 10, color: hasSynced ? colors.bg : colors.textMuted, fontWeight: '600' }}>{hasSynced ? 'LRC' : 'TXT'}</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.dlBtn, { backgroundColor: isDownloaded ? colors.bgCard : colors.accent }]}
                      onPress={() => !isDownloaded && handleDownloadLyrics(r)}
                      disabled={isDownloaded}>
                      <Icon name={isDownloaded ? 'checkmark' : 'download-outline'} size={18} color={isDownloaded ? colors.accent : colors.bg} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (lyrics.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="musical-notes-outline" size={64} color={colors.textMuted} />
        <Text style={{ fontSize: sizes.xl, color: colors.textSecondary, marginTop: 16, fontWeight: '600' }}>{t('lyrics.empty.title')}</Text>
        <Text style={{ fontSize: sizes.md, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>{t('lyrics.empty.supportedFormats')}{'\n'}{t('lyrics.empty.fileLocation')}</Text>
        {currentTrack && (
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.accent }]}
            onPress={handleSearchLyrics}>
            <Icon name="search-outline" size={18} color={colors.bg} />
            <Text style={{ fontSize: sizes.md, fontWeight: '600', color: colors.bg }}>{t('lyrics.search.title')}</Text>
          </TouchableOpacity>
        )}
        {renderSearchModal()}
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

      {showOffsetBar && (
        <View style={[styles.offsetBar, { backgroundColor: colors.bgElevated, borderTopColor: colors.border }]}>
          <Text style={{ fontSize: sizes.sm, color: colors.textSecondary, fontWeight: '600' }}>{t('lyrics.offset.title')}</Text>
          <TouchableOpacity onPress={() => adjustOffset(-OFFSET_STEP)} style={[styles.offsetBtn, { backgroundColor: colors.bgCard }]}>
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '700' }}>-</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: sizes.md, color: colors.accent, fontWeight: '700', fontVariant: ['tabular-nums'], minWidth: 60, textAlign: 'center' }}>
            {lyricsOffset >= 0 ? '+' : ''}{lyricsOffset.toFixed(1)}s
          </Text>
          <TouchableOpacity onPress={() => adjustOffset(OFFSET_STEP)} style={[styles.offsetBtn, { backgroundColor: colors.bgCard }]}>
            <Text style={{ fontSize: sizes.md, color: colors.textPrimary, fontWeight: '700' }}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resetOffset} style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: sizes.sm, color: colors.textMuted }}>{t('lyrics.offset.reset')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.ctrlBar, { backgroundColor: colors.bgGlass, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={seekToPrevLyric} style={[styles.ctrlBtn, { backgroundColor: colors.accentDim }]} activeOpacity={0.6}>
          <Icon name="play-back" size={18} color={colors.accent} /><Text style={{ fontSize: sizes.sm, color: colors.accent, fontWeight: '600' }}>{t('lyrics.controls.prev')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={replayCurrentLyric} style={[styles.ctrlBtn, styles.replayBtn, { backgroundColor: colors.accent }]} activeOpacity={0.6}>
          <Icon name="refresh" size={20} color={colors.bg} /><Text style={{ fontSize: sizes.sm, color: colors.bg, fontWeight: '600' }}>{t('lyrics.controls.replay')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={seekToNextLyric} style={[styles.ctrlBtn, { backgroundColor: colors.accentDim }]} activeOpacity={0.6}>
          <Icon name="play-forward" size={18} color={colors.accent} /><Text style={{ fontSize: sizes.sm, color: colors.accent, fontWeight: '600' }}>{t('lyrics.controls.next')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowOffsetBar(!showOffsetBar)} style={styles.offsetToggle} activeOpacity={0.6}>
          <Icon name="timer-outline" size={18} color={showOffsetBar ? colors.accent : colors.textMuted} />
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
  offsetBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, gap: 8, borderTopWidth: 1 },
  offsetBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  offsetToggle: { position: 'absolute', right: 16, padding: 4 },
  searchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  searchSheet: { maxHeight: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  searchCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  dlBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

export default memo(LyricsView);
