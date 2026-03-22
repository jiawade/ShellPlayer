import RNFS from 'react-native-fs';

export interface LrcSearchResult {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

export async function searchLyrics(
  title: string,
  artist: string,
): Promise<LrcSearchResult[]> {
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    const response = await fetch(`https://lrclib.net/api/search?${params}`);
    if (!response.ok) {
      return [];
    }
    const data: LrcSearchResult[] = await response.json();
    return data.sort((a, b) => {
      if (a.syncedLyrics && !b.syncedLyrics) return -1;
      if (!a.syncedLyrics && b.syncedLyrics) return 1;
      return 0;
    });
  } catch {
    return [];
  }
}

export async function downloadAndSaveLyrics(
  result: LrcSearchResult,
  savePath: string,
): Promise<boolean> {
  try {
    const content = result.syncedLyrics ?? result.plainLyrics;
    if (!content) {
      return false;
    }
    await RNFS.writeFile(savePath, content, 'utf8');
    return true;
  } catch {
    return false;
  }
}
