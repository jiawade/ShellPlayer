// src/utils/scanner.ts
import RNFS from 'react-native-fs';
import { Track } from '../types';
import { SUPPORTED_FORMATS } from './theme';
import { parseID3 } from './id3Parser';
import { saveArtworkFile } from './artworkCache';

function titleFromFilename(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.substring(0, dot) : fileName;
}

async function findLrcFile(filePath: string): Promise<string | undefined> {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return undefined;
  const lrcPath = filePath.substring(0, dot) + '.lrc';
  try {
    return (await RNFS.exists(lrcPath)) ? lrcPath : undefined;
  } catch { return undefined; }
}

async function scanDirectory(dirPath: string, depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  const results: string[] = [];
  try {
    if (!(await RNFS.exists(dirPath))) return results;
    const items = await RNFS.readDir(dirPath);
    for (const item of items) {
      if (item.isDirectory()) {
        results.push(...(await scanDirectory(item.path, depth + 1)));
      } else if (item.isFile()) {
        const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) results.push(item.path);
      }
    }
  } catch {}
  return results;
}

export type ScanProgress = {
  phase: 'scanning' | 'parsing';
  current: number;
  total: number;
};

export async function scanAllMusic(
  directories: string[],
  onProgress?: (p: ScanProgress) => void,
): Promise<Track[]> {
  onProgress?.({ phase: 'scanning', current: 0, total: directories.length });
  const allFiles: string[] = [];
  for (let i = 0; i < directories.length; i++) {
    const files = await scanDirectory(directories[i]);
    allFiles.push(...files);
    onProgress?.({ phase: 'scanning', current: i + 1, total: directories.length });
  }

  const uniqueFiles = [...new Set(allFiles)];
  const tracks: Track[] = [];
  const total = uniqueFiles.length;
  const batchSize = 5;

  for (let i = 0; i < total; i += batchSize) {
    const batch = uniqueFiles.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        const id3 = await parseID3(filePath);
        const lrcPath = await findLrcFile(filePath);

        // 如果有封面，保存为文件，artwork 存 file:// 路径
        let artworkUri: string | undefined;
        if (id3.artwork) {
          artworkUri = await saveArtworkFile(filePath, id3.artwork);
        }

        return {
          id: filePath,
          url: `file://${filePath}`,
          title: id3.title || titleFromFilename(fileName),
          artist: id3.artist || '未知歌手',
          album: id3.album || '未知专辑',
          artwork: artworkUri,  // file:// URI 而非 base64
          fileName, filePath,
          isFavorite: false,
          lrcPath,
          embeddedLyrics: id3.lyrics,
        } as Track;
      }),
    );
    tracks.push(...batchResults);
    onProgress?.({ phase: 'parsing', current: Math.min(i + batchSize, total), total });
  }

  tracks.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  return tracks;
}

export async function readLrcFile(lrcPath: string): Promise<string> {
  try { return await RNFS.readFile(lrcPath, 'utf8'); }
  catch { return ''; }
}

export async function listSubDirectories(parentPath: string): Promise<string[]> {
  const dirs: string[] = [];
  try {
    if (!(await RNFS.exists(parentPath))) return dirs;
    const items = await RNFS.readDir(parentPath);
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.')) dirs.push(item.path);
    }
  } catch {}
  dirs.sort((a, b) => a.localeCompare(b));
  return dirs;
}
