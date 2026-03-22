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

  return TagWriterModule.writeMetadata(filePath, tags);
}
