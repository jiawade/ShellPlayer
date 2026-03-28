import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store';
import RNFS from 'react-native-fs';
import { exportTrackToFile } from '../utils/mediaLibrary';
import TrackPlayer from 'react-native-track-player';

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

const extractFormat = (filePath: string): string => {
  // Strip query params (e.g. ipod-library://...item.mp3?id=123) and scheme
  const pathOnly = filePath.split('?')[0];
  const ext = pathOnly.split('.').pop()?.toUpperCase();
  return ext || 'N/A';
};

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  colors: any;
  isLast?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, colors, isLast }) => (
  <View
    style={[
      styles.infoRow,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    ]}>
    <View style={styles.rowLeft}>
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
    <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
  </View>
);

const AudioAnalyzer: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const currentTrack = useAppSelector(s => s.music.currentTrack);

  const [fileSize, setFileSize] = useState<string>('');
  const [estimatedBitrate, setEstimatedBitrate] = useState<string>('');
  const [actualDuration, setActualDuration] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!currentTrack?.filePath) {
      setFileSize('');
      setEstimatedBitrate('');
      setActualDuration(undefined);
      return;
    }

    let cancelled = false;

    const getFileStats = async () => {
      try {
        // Get duration from TrackPlayer as fallback (works on Android even when metadata is missing)
        let duration = currentTrack.duration;
        if (!duration || duration <= 0) {
          try {
            const progress = await TrackPlayer.getProgress();
            if (progress.duration > 0) {
              duration = progress.duration;
            }
          } catch {}
        }
        if (!cancelled) setActualDuration(duration);

        let statPath = currentTrack.filePath;
        // iPod library URLs need export to get a real file path for stat
        if (currentTrack.url.startsWith('ipod-library://')) {
          statPath = await exportTrackToFile(currentTrack.url);
        }
        // On Android, try url as fallback if filePath stat fails
        let bytes = 0;
        try {
          const stat = await RNFS.stat(statPath);
          bytes = Number(stat.size);
        } catch {
          if (Platform.OS === 'android' && currentTrack.url && !currentTrack.url.startsWith('ipod-library://')) {
            try {
              const stat = await RNFS.stat(currentTrack.url);
              bytes = Number(stat.size);
            } catch {}
          }
        }
        if (cancelled) return;

        if (bytes > 0) {
          setFileSize(formatFileSize(bytes));
          if (duration && duration > 0) {
            const kbps = Math.round((bytes * 8) / duration / 1000);
            setEstimatedBitrate(`~${kbps} kbps`);
          } else {
            setEstimatedBitrate('N/A');
          }
        } else {
          setFileSize('N/A');
          setEstimatedBitrate('N/A');
        }
      } catch {
        if (cancelled) return;
        setFileSize('N/A');
        setEstimatedBitrate('N/A');
      }
    };

    getFileStats();

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.filePath, currentTrack?.url, currentTrack?.duration]);

  if (!currentTrack) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bgCard }]}>
        <Icon name="musical-notes-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('audioAnalyzer.title')}
        </Text>
      </View>
    );
  }

  const format = extractFormat(currentTrack.url || currentTrack.filePath);

  // Estimate sample rate based on format
  const sampleRate = (() => {
    const f = format.toUpperCase();
    if (f === 'FLAC' || f === 'WAV' || f === 'AIFF' || f === 'ALAC') return '44.1 kHz';
    if (f === 'MP3' || f === 'AAC' || f === 'M4A' || f === 'OGG') return '44.1 kHz';
    return 'N/A';
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* File Information */}
      <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('audioAnalyzer.title')}
        </Text>
        <InfoRow
          icon="document-outline"
          label={t('audioAnalyzer.format')}
          value={format}
          colors={colors}
        />
        <InfoRow
          icon="server-outline"
          label={t('audioAnalyzer.fileSize')}
          value={fileSize || '...'}
          colors={colors}
        />
        <InfoRow
          icon="time-outline"
          label={t('audioAnalyzer.duration')}
          value={formatDuration(actualDuration ?? currentTrack.duration)}
          colors={colors}
          isLast
        />
      </View>

      {/* Audio Info */}
      <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {t('audioAnalyzer.audioInfo')}
        </Text>
        <InfoRow
          icon="radio-outline"
          label={t('audioAnalyzer.sampleRate')}
          value={sampleRate}
          colors={colors}
        />
        <InfoRow
          icon="speedometer-outline"
          label={t('audioAnalyzer.bitRate')}
          value={estimatedBitrate || '...'}
          colors={colors}
        />
        <InfoRow
          icon="headset-outline"
          label={t('audioAnalyzer.channels')}
          value={t('audioAnalyzer.stereo')}
          colors={colors}
          isLast
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '55%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    borderRadius: 16,
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AudioAnalyzer;
