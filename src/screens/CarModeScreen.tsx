import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store';
import TrackPlayer from 'react-native-track-player';
import CoverArt from '../components/CoverArt';
import ProgressBar from '../components/ProgressBar';
import { useNavigation } from '@react-navigation/native';
import { usePlayerSync } from '../hooks/usePlayerProgress';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ART_SIZE = SCREEN_WIDTH * 0.7;

const CarModeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const currentTrack = useAppSelector(s => s.music.currentTrack);
  const isPlaying = useAppSelector(s => s.music.isPlaying);
  const { position, duration } = usePlayerSync();

  const handlePrevious = () => TrackPlayer.skipToPrevious();
  const handlePlayPause = () => (isPlaying ? TrackPlayer.pause() : TrackPlayer.play());
  const handleNext = () => TrackPlayer.skipToNext();

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Top bar */}
      <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={28} color="#FFF" />
        <Text style={styles.exitText}>{t('carMode.exit')}</Text>
      </TouchableOpacity>

      {/* Center area */}
      <View style={styles.centerArea}>
        <CoverArt artwork={currentTrack?.artwork} size={ART_SIZE} borderRadius={20} />
        <Text style={styles.title} numberOfLines={1}>
          {currentTrack?.title ?? ''}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {currentTrack?.artist ?? ''}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <ProgressBar position={position} duration={duration} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.sideButton} onPress={handlePrevious}>
          <Icon name="play-skip-back" size={48} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: colors.accent }]}
          onPress={handlePlayPause}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={56} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.sideButton} onPress={handleNext}>
          <Icon name="play-skip-forward" size={48} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 16,
    paddingBottom: 40,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 80,
  },
  exitText: {
    color: '#FFF',
    fontSize: 20,
    marginLeft: 12,
    fontWeight: '600',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  artist: {
    color: '#AAA',
    fontSize: 20,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingBottom: 16,
  },
  sideButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CarModeScreen;
