// src/utils/liveActivity.ts
// Controls the Dynamic Island Live Activity from React Native.
import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

const { LiveActivityManager } = NativeModules;

let active = false;
let cachedArtworkBase64: string | undefined;
let cachedTrackId: string | undefined;

/**
 * Check if Dynamic Island / Live Activities are supported on this device.
 */
export async function isLiveActivitySupported(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !LiveActivityManager) return false;
  try {
    return await LiveActivityManager.isSupported();
  } catch {
    return false;
  }
}

/**
 * Convert artwork (file:// URI or data: URI) to a small base64 thumbnail.
 * Returns undefined if artwork is unavailable.
 */
async function artworkToBase64(artwork?: string): Promise<string | undefined> {
  if (!artwork) return undefined;
  try {
    if (artwork.startsWith('data:image')) {
      // Already base64 — extract just the data portion
      const idx = artwork.indexOf(',');
      return idx >= 0 ? artwork.substring(idx + 1) : undefined;
    }
    if (artwork.startsWith('file://')) {
      const path = artwork.replace('file://', '');
      if (await RNFS.exists(path)) {
        return await RNFS.readFile(path, 'base64');
      }
    }
  } catch {}
  return undefined;
}

/**
 * Start a new Dynamic Island Live Activity.
 */
export async function startLiveActivity(
  trackId: string,
  title: string,
  artist: string,
  _artwork?: string,
): Promise<void> {
  if (Platform.OS !== 'ios' || !LiveActivityManager) return;
  try {
    cachedTrackId = trackId;
    // Don't send artwork - ActivityKit has a 4KB payload limit
    await LiveActivityManager.start(
      trackId,
      title,
      artist,
      null,
    );
    active = true;
  } catch (e) {
    console.warn('[LiveActivity] start failed:', e);
  }
}

/**
 * Update the Dynamic Island with current playback state and audio levels.
 */
export async function updateLiveActivity(
  isPlaying: boolean,
  title: string,
  artist: string,
  progress: number,
  _artwork?: string,
): Promise<void> {
  if (!active || Platform.OS !== 'ios' || !LiveActivityManager) return;
  try {
    await LiveActivityManager.update(
      isPlaying,
      title,
      artist,
      progress,
      null,
    );
  } catch {}
}

/**
 * Stop the Dynamic Island Live Activity.
 */
export async function stopLiveActivity(): Promise<void> {
  if (!active || Platform.OS !== 'ios' || !LiveActivityManager) return;
  try {
    await LiveActivityManager.stop();
    active = false;
    cachedArtworkBase64 = undefined;
    cachedTrackId = undefined;
  } catch {}
}

/**
 * Update just the artwork (e.g., when cover art is repaired).
 */
export function updateCachedArtwork(trackId: string, artwork?: string): void {
  if (cachedTrackId === trackId && artwork) {
    artworkToBase64(artwork).then(b64 => {
      if (b64) cachedArtworkBase64 = b64;
    });
  }
}

export function isLiveActivityActive(): boolean {
  return active;
}
