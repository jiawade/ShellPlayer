// src/utils/bluetoothLyrics.ts
// Sends current lyric line to car display via NowPlaying metadata (AVRCP).
// Works with Bluetooth car stereos, CarPlay, and Android Auto.
import TrackPlayer from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@bt_lyrics_enabled';

let enabled = false;
let originalTitle = '';
let originalArtist = '';
let originalArtwork: string | undefined;

export async function loadBluetoothLyricsSetting(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    enabled = val === '1';
  } catch {
    enabled = false;
  }
  return enabled;
}

export async function setBluetoothLyricsEnabled(value: boolean): Promise<void> {
  enabled = value;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {}
  if (!value) {
    restoreOriginalMetadata();
  }
}

export function isBluetoothLyricsEnabled(): boolean {
  return enabled;
}

/** Call when a new track starts to remember its real title/artist. */
export function setOriginalTrackInfo(title: string, artist: string, artwork?: string): void {
  originalTitle = title;
  originalArtist = artist;
  originalArtwork = artwork;
}

/** Push the current lyric line into NowPlaying metadata so car displays show it. */
export async function pushLyricToNowPlaying(lyricText: string): Promise<void> {
  if (!enabled || !lyricText) {
    return;
  }
  try {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.updateNowPlayingMetadata({
      title: lyricText,
      artist: `${originalTitle} - ${originalArtist}`,
      artwork: originalArtwork,
      elapsedTime: position,
    });
  } catch {}
}

/** Restore the real song title in NowPlaying metadata. */
export async function restoreOriginalMetadata(): Promise<void> {
  if (!originalTitle) {
    return;
  }
  try {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.updateNowPlayingMetadata({
      title: originalTitle,
      artist: originalArtist,
      artwork: originalArtwork,
      elapsedTime: position,
    });
  } catch {}
}
