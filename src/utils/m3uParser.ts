import RNFS from 'react-native-fs';
import {Platform} from 'react-native';
import {Track} from '../types';

export function parseM3U(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

export function generateM3U(tracks: Track[]): string {
  const lines = ['#EXTM3U'];
  for (const track of tracks) {
    const duration =
      track.duration != null ? Math.round(track.duration) : -1;
    lines.push(`#EXTINF:${duration},${track.artist} - ${track.title}`);
    lines.push(track.filePath);
  }
  return lines.join('\n');
}

export async function exportToFile(
  content: string,
  filename: string,
): Promise<string> {
  const name = filename.endsWith('.m3u') ? filename : `${filename}.m3u`;
  const dir =
    Platform.OS === 'ios'
      ? RNFS.DocumentDirectoryPath
      : RNFS.ExternalStorageDirectoryPath ?? RNFS.DownloadDirectoryPath;
  const filePath = `${dir}/${name}`;
  await RNFS.writeFile(filePath, content, 'utf8');
  return filePath;
}

export function matchM3UTracks(
  paths: string[],
  allTracks: Track[],
): {matched: Track[]; unmatched: string[]} {
  const matched: Track[] = [];
  const unmatched: string[] = [];

  const byPath = new Map(allTracks.map(t => [t.filePath, t]));
  const byName = new Map(allTracks.map(t => [t.fileName, t]));

  for (const p of paths) {
    const track =
      byPath.get(p) ?? byName.get(p.split('/').pop() ?? '');
    if (track) {
      matched.push(track);
    } else {
      unmatched.push(p);
    }
  }

  return {matched, unmatched};
}
