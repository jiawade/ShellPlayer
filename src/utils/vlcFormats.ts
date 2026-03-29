// src/utils/vlcFormats.ts
import { Track } from '../types';
import { Platform } from 'react-native';

// Formats that iOS AVPlayer cannot handle → route to VLC
const IOS_VLC_FORMATS = ['.wma', '.ape', '.webm'] as const;

// Formats that Android ExoPlayer/TrackPlayer handles reliably
const ANDROID_TRACKPLAYER_SAFE_FORMATS = [
  '.mp3',
  '.wav',
  '.opus',
  '.m4a',
  '.ogg',
  '.aac',
  '.flac',
  '.webm',
] as const;

export function shouldUseVlcForTrack(track: Pick<Track, 'fileName'> | null | undefined): boolean {
  if (!track?.fileName) return false;
  const dot = track.fileName.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = track.fileName.substring(dot).toLowerCase();

  // On Android, current TrackPlayer/Exo setup is only stable for a narrow subset.
  // Route the rest through VLC to avoid false playback errors and auto-skip.
  if (Platform.OS === 'android') {
    return !ANDROID_TRACKPLAYER_SAFE_FORMATS.includes(
      ext as (typeof ANDROID_TRACKPLAYER_SAFE_FORMATS)[number],
    );
  }

  // On iOS, AVPlayer handles most formats; only route specific ones to VLC.
  return IOS_VLC_FORMATS.includes(ext as (typeof IOS_VLC_FORMATS)[number]);
}
