// src/screens/StatisticsScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector } from '../store';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_DAYS = 35;
const HEATMAP_COLS = 5;

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const { colors, sizes } = useTheme();
  const navigation = useNavigation();
  const { dailyListenTime, trackPlayCounts, artistPlayTime } = useAppSelector(s => s.stats);
  const tracks = useAppSelector(s => s.music.tracks);

  const today = new Date().toISOString().slice(0, 10);
  const todayTime = dailyListenTime[today] || 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekTime = useMemo(() => {
    return Object.entries(dailyListenTime)
      .filter(([d]) => d >= weekStart.toISOString().slice(0, 10))
      .reduce((sum, [, s]) => sum + s, 0);
  }, [dailyListenTime]);

  const monthStart = new Date().toISOString().slice(0, 7);
  const monthTime = useMemo(() => {
    return Object.entries(dailyListenTime)
      .filter(([d]) => d.startsWith(monthStart))
      .reduce((sum, [, s]) => sum + s, 0);
  }, [dailyListenTime]);

  const totalTime = useMemo(() => {
    return Object.values(dailyListenTime).reduce((s, v) => s + v, 0);
  }, [dailyListenTime]);

  const topSongs = useMemo(() => {
    return Object.entries(trackPlayCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id, count]) => {
        const track = tracks.find(t => t.id === id);
        return { id, count, title: track?.title || id, artist: track?.artist || '' };
      });
  }, [trackPlayCounts, tracks]);

  const topArtists = useMemo(() => {
    return Object.entries(artistPlayTime)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [artistPlayTime]);

  // Build heatmap grid: 7 rows (Mon–Sun) × ~5 columns, last 35 days
  const heatmapData = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Find the start: go back HEATMAP_DAYS-1 days from today, then back to Monday
    const rawStart = new Date(end);
    rawStart.setDate(rawStart.getDate() - (HEATMAP_DAYS - 1));
    const dayOfWeek = rawStart.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const start = new Date(rawStart);
    start.setDate(start.getDate() + mondayOffset);

    const days: { date: string; time: number; row: number; col: number }[] = [];
    const cursor = new Date(start);
    let col = 0;
    while (cursor <= end) {
      const dow = cursor.getDay(); // 0=Sun
      const row = dow === 0 ? 6 : dow - 1; // Mon=0 ... Sun=6
      const dateStr = cursor.toISOString().slice(0, 10);
      days.push({ date: dateStr, time: dailyListenTime[dateStr] || 0, row, col });
      if (row === 6) col++;
      cursor.setDate(cursor.getDate() + 1);
    }
    const maxTime = Math.max(...days.map(d => d.time), 1);
    const totalCols = col + 1;
    const startLabel = start.toISOString().slice(0, 10);
    const endLabel = end.toISOString().slice(0, 10);
    return { days, maxTime, totalCols, startLabel, endLabel };
  }, [dailyListenTime]);

  // Format distribution computed from track file extensions
  const formatStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const track of tracks) {
      const ext = (track.filePath || '').split('.').pop()?.toLowerCase() || 'unknown';
      counts[ext] = (counts[ext] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
    const total = tracks.length;
    const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
    return { items: sorted, total, maxCount };
  }, [tracks]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}${t('statistics.hours')} ${m}${t('statistics.minutes')}`;
    return `${m}${t('statistics.minutes')}`;
  };

  const getHeatColor = (time: number, maxTime: number) => {
    if (time === 0) return colors.bgCard;
    const intensity = Math.min(time / maxTime, 1);
    // 4 levels of opacity
    if (intensity < 0.25) return colors.accent + '40';
    if (intensity < 0.5) return colors.accent + '80';
    if (intensity < 0.75) return colors.accent + 'B3';
    return colors.accent;
  };

  const FORMAT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Icon name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('statistics.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cardRow}>
          {[
            { label: t('statistics.today'), value: todayTime },
            { label: t('statistics.thisWeek'), value: weekTime },
            { label: t('statistics.thisMonth'), value: monthTime },
            { label: t('statistics.allTime'), value: totalTime },
          ].map((item) => (
            <View key={item.label} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.cardValue, { color: colors.accent }]}>{formatTime(item.value)}</Text>
              <Text style={[styles.cardLabel, { color: colors.textSecondary, fontSize: sizes.sm }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {topSongs.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('statistics.topSongs')}</Text>
            {topSongs.map((song, i) => (
              <View key={song.id} style={[styles.rankRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.rankNum, { color: i < 3 ? colors.accent : colors.textMuted }]}>{i + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankTitle, { color: colors.textPrimary }]} numberOfLines={1}>{song.title}</Text>
                  <Text style={[styles.rankSub, { color: colors.textSecondary }]} numberOfLines={1}>{song.artist}</Text>
                </View>
                <Text style={[styles.rankCount, { color: colors.textMuted }]}>{song.count} {t('statistics.plays')}</Text>
              </View>
            ))}
          </View>
        )}

        {topArtists.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('statistics.topArtists')}</Text>
            {topArtists.map(([artist, time], i) => (
              <View key={artist} style={[styles.rankRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.rankNum, { color: i < 3 ? colors.accent : colors.textMuted }]}>{i + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankTitle, { color: colors.textPrimary }]} numberOfLines={1}>{artist}</Text>
                </View>
                <Text style={[styles.rankCount, { color: colors.textMuted }]}>{formatTime(time)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Calendar Heatmap */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('statistics.heatmap')}</Text>
          <Text style={[styles.heatmapRange, { color: colors.textMuted }]}>
            {heatmapData.startLabel} ~ {heatmapData.endLabel}
          </Text>
          {heatmapData.days.length > 0 ? (
            <View style={styles.heatmapContainer}>
              {/* Day labels column */}
              <View style={styles.heatmapLabels}>
                {DAY_LABELS.map(label => (
                  <View key={label} style={styles.heatmapLabelCell}>
                    <Text style={[styles.heatmapLabelText, { color: colors.textMuted }]}>{label}</Text>
                  </View>
                ))}
              </View>
              {/* Grid */}
              <View style={styles.heatmapGrid}>
                {Array.from({ length: heatmapData.totalCols }).map((_, col) => (
                  <View key={col} style={styles.heatmapColumn}>
                    {Array.from({ length: 7 }).map((_, row) => {
                      const cell = heatmapData.days.find(d => d.row === row && d.col === col);
                      return (
                        <View
                          key={row}
                          style={[
                            styles.heatmapCell,
                            {
                              backgroundColor: cell
                                ? getHeatColor(cell.time, heatmapData.maxTime)
                                : 'transparent',
                              borderColor: cell ? colors.border : 'transparent',
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={[styles.noDataText, { color: colors.textMuted }]}>{t('statistics.noData')}</Text>
          )}
        </View>

        {/* Format Distribution */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('statistics.formatDistribution')}</Text>
          {formatStats.items.length > 0 ? (
            <View style={styles.formatList}>
              {formatStats.items.map(([ext, count], i) => {
                const pct = formatStats.total > 0 ? ((count / formatStats.total) * 100).toFixed(1) : '0';
                const barRatio = count / formatStats.maxCount;
                const barColor = FORMAT_COLORS[i % FORMAT_COLORS.length];
                return (
                  <View key={ext} style={styles.formatRow}>
                    <View style={styles.formatLabelRow}>
                      <Text style={[styles.formatName, { color: colors.textPrimary }]}>{ext.toUpperCase()}</Text>
                      <Text style={[styles.formatDetail, { color: colors.textMuted }]}>
                        {count} {t('statistics.tracks')} · {pct}%
                      </Text>
                    </View>
                    <View style={[styles.formatBarBg, { backgroundColor: colors.bg }]}>
                      <View style={[styles.formatBar, { width: `${barRatio * 100}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.noDataText, { color: colors.textMuted }]}>{t('statistics.noData')}</Text>
          )}
        </View>

        {topSongs.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="stats-chart-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('history.empty.message')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cardValue: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardLabel: {},
  section: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', padding: 14, paddingBottom: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 0.5, gap: 10 },
  rankNum: { width: 24, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  rankInfo: { flex: 1 },
  rankTitle: { fontSize: 14, fontWeight: '500' },
  rankSub: { fontSize: 12, marginTop: 2 },
  rankCount: { fontSize: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  // Heatmap styles
  heatmapRange: { fontSize: 12, paddingHorizontal: 14, marginBottom: 8 },
  heatmapContainer: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 14 },
  heatmapLabels: { marginRight: 6 },
  heatmapLabelCell: { height: 20, justifyContent: 'center', marginBottom: 3 },
  heatmapLabelText: { fontSize: 10 },
  heatmapGrid: { flex: 1, flexDirection: 'row', gap: 3 },
  heatmapColumn: { flex: 1, gap: 3 },
  heatmapCell: { height: 20, borderRadius: 4, borderWidth: 0.5 },
  noDataText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  // Format distribution styles
  formatList: { paddingHorizontal: 14, paddingBottom: 14 },
  formatRow: { marginBottom: 10 },
  formatLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  formatName: { fontSize: 13, fontWeight: '600' },
  formatDetail: { fontSize: 11 },
  formatBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  formatBar: { height: '100%', borderRadius: 4 },
});
