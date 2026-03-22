// src/utils/tagWriter.ts
import { NativeModules, Platform } from 'react-native';

const { TagWriterModule } = NativeModules;

/**
 * Updates ID3/metadata tags for a music file.
 * Uses native TagWriterModule (jaudiotagger on Android, AVFoundation/ID3 on iOS).
 */
export async function updateTrackTags(
  filePath: string,
  tags: {title?: string; artist?: string; album?: string},
): Promise<boolean> {
  if (!TagWriterModule) {
    console.warn('[TagWriter] Native module not available');
    return false;
  }

  // iPod library URLs can't be written to
  if (Platform.OS === 'ios' && filePath.startsWith('ipod-library://')) {
    return false;
  }

  try {
    return await TagWriterModule.writeMetadata(filePath, tags);
  } catch {
    return false;
  }
}

/**
 * Writes artwork (cover art) to a music file's tags.
 * @param filePath Path to the audio file
 * @param imagePath Path to the image file (JPEG) to embed
 */
export async function writeTrackArtwork(
  filePath: string,
  imagePath: string,
): Promise<boolean> {
  if (!TagWriterModule?.writeArtwork) {
    console.warn('[TagWriter] writeArtwork not available');
    return false;
  }

  if (Platform.OS === 'ios' && filePath.startsWith('ipod-library://')) {
    return false;
  }

  try {
    return await TagWriterModule.writeArtwork(filePath, imagePath);
  } catch {
    return false;
  }
}
