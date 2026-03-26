// src/utils/scanner.ts
import RNFS from 'react-native-fs';
import {Track} from '../types';
import {SUPPORTED_FORMATS} from './theme';
import {parseID3} from './id3Parser';
import {saveArtworkFile} from './artworkCache';

function titleFromFilename(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.substring(0, dot) : fileName;
}

async function findLrcFile(filePath: string): Promise<string | undefined> {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) {
    return undefined;
  }
  const lrcPath = filePath.substring(0, dot) + '.lrc';
  try {
    return (await RNFS.exists(lrcPath)) ? lrcPath : undefined;
  } catch {
    return undefined;
  }
}

async function scanDirectory(dirPath: string, depth = 0): Promise<string[]> {
  if (depth > 3) {
    return [];
  }
  const results: string[] = [];
  try {
    if (!(await RNFS.exists(dirPath))) {
      return results;
    }
    const items = await RNFS.readDir(dirPath);
    for (const item of items) {
      if (item.isDirectory()) {
        results.push(...(await scanDirectory(item.path, depth + 1)));
      } else if (item.isFile()) {
        const ext = item.name
          .substring(item.name.lastIndexOf('.'))
          .toLowerCase();
        if (SUPPORTED_FORMATS.includes(ext)) {
          results.push(item.path);
        }
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
  onProgress?.({phase: 'scanning', current: 0, total: directories.length});
  const allFiles: string[] = [];
  for (let i = 0; i < directories.length; i++) {
    const files = await scanDirectory(directories[i]);
    allFiles.push(...files);
    onProgress?.({
      phase: 'scanning',
      current: i + 1,
      total: directories.length,
    });
  }

  const uniqueFiles = [...new Set(allFiles)];
  const tracks: Track[] = [];
  const total = uniqueFiles.length;
  const batchSize = 5;

  for (let i = 0; i < total; i += batchSize) {
    const batch = uniqueFiles.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async filePath => {
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
          artwork: artworkUri, // file:// URI 而非 base64
          fileName,
          filePath,
          isFavorite: false,
          lrcPath,
          embeddedLyrics: id3.lyrics,
          year: id3.year,
          genre: id3.genre,
          trackNumber: id3.trackNumber,
          composer: id3.composer,
          comment: id3.comment,
        } as Track;
      }),
    );
    tracks.push(...batchResults);
    onProgress?.({
      phase: 'parsing',
      current: Math.min(i + batchSize, total),
      total,
    });
  }

  tracks.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  return tracks;
}

export async function readLrcFile(lrcPath: string): Promise<string> {
  try {
    return await RNFS.readFile(lrcPath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Search the lrc directory for a .lrc file that best matches the given track.
 * Matching priority:
 *   1. Exact filename base (e.g. "周杰伦 - 晴天.lrc" matches "周杰伦 - 晴天.mp3")
 *   2. Exact title match (e.g. "晴天.lrc")
 *   3. Artist–title combos ("周杰伦 - 晴天.lrc" or "晴天 - 周杰伦.lrc")
 *   4. Partial: lrc filename contains the title as a component
 */
export async function findMatchingLrcInDir(
  track: {title: string; artist: string; fileName: string},
  lrcDir: string,
): Promise<string | undefined> {
  try {
    if (!(await RNFS.exists(lrcDir))) return undefined;
    const items = await RNFS.readDir(lrcDir);
    const lrcFiles = items.filter(
      i => i.isFile() && i.name.toLowerCase().endsWith('.lrc'),
    );
    if (lrcFiles.length === 0) return undefined;

    const title = track.title.trim();
    const artist = track.artist.trim();
    const hasArtist = artist && artist !== '未知歌手';
    const dot = track.fileName.lastIndexOf('.');
    const fileBase = (dot > 0 ? track.fileName.substring(0, dot) : track.fileName).trim();

    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

    const lrcMap = lrcFiles.map(f => {
      const d = f.name.lastIndexOf('.');
      return {path: f.path, base: normalize(d > 0 ? f.name.substring(0, d) : f.name)};
    });

    const match = (candidate: string): string | undefined => {
      const n = normalize(candidate);
      if (!n) return undefined;
      return lrcMap.find(l => l.base === n)?.path;
    };

    // Priority 1: exact filename base
    let found = match(fileBase);
    if (found) return found;

    // Priority 2: exact title
    found = match(title);
    if (found) return found;

    // Priority 3: artist-title combos
    if (hasArtist) {
      found = match(`${artist} - ${title}`);
      if (found) return found;
      found = match(`${title} - ${artist}`);
      if (found) return found;
    }

    // Priority 4: for tracks named "artist - title" or "title - artist",
    // extract parts from filename and try reversed combos
    const parts = fileBase.split(/\s*-\s*/);
    if (parts.length === 2) {
      const [a, b] = parts;
      found = match(a) || match(b) || match(`${b} - ${a}`);
      if (found) return found;
    }

    // Priority 5: partial match – lrc contains the title as a dash-separated component
    if (title) {
      const nt = normalize(title);
      for (const lrc of lrcMap) {
        const lrcParts = lrc.base.split(/\s*-\s*/);
        if (lrcParts.some(p => p.trim() === nt)) return lrc.path;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function listSubDirectories(
  parentPath: string,
): Promise<string[]> {
  const dirs: string[] = [];
  try {
    if (!(await RNFS.exists(parentPath))) {
      return dirs;
    }
    const items = await RNFS.readDir(parentPath);
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.')) {
        dirs.push(item.path);
      }
    }
  } catch {}
  dirs.sort((a, b) => a.localeCompare(b));
  return dirs;
}
