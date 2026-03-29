import RNFS from 'react-native-fs';
import { Track } from '../types';

const AUDIO_EXTENSIONS = [
  '.mp3',
  '.flac',
  '.m4a',
  '.aac',
  '.wav',
  '.ogg',
  '.wma',
  '.aiff',
  '.opus',
  '.ape',
  '.webm',
];

export interface FolderItem {
  name: string;
  path: string;
}

export interface AudioFileItem {
  name: string;
  path: string;
  size: number;
  mtime: Date | undefined;
}

export function isAudioFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export async function listFolderContents(
  path: string,
): Promise<{folders: FolderItem[]; audioFiles: AudioFileItem[]}> {
  const items = await RNFS.readDir(path);
  const folders: FolderItem[] = [];
  const audioFiles: AudioFileItem[] = [];

  for (const item of items) {
    if (item.isDirectory()) {
      folders.push({ name: item.name, path: item.path });
    } else if (isAudioFile(item.name)) {
      audioFiles.push({
        name: item.name,
        path: item.path,
        size: item.size,
        mtime: item.mtime,
      });
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  audioFiles.sort((a, b) => a.name.localeCompare(b.name));

  return { folders, audioFiles };
}

export async function countAudioFiles(path: string): Promise<number> {
  try {
    const items = await RNFS.readDir(path);
    let count = 0;
    for (const item of items) {
      if (item.isDirectory()) {
        count += await countAudioFiles(item.path);
      } else if (isAudioFile(item.name)) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

export function getTracksInFolder(
  folderPath: string,
  allTracks: Track[],
): Track[] {
  return allTracks.filter(track => track.filePath?.startsWith(folderPath));
}
