// src/utils/coverArtSearch.ts
// Chinese → NetEase Cloud Music API  |  Others → iTunes API
import RNFS from 'react-native-fs';
import { saveArtworkFile } from './artworkCache';
import i18n from '../i18n';

export interface CoverSearchResult {
  id: number;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string; // high-res URL
  thumbUrl: string;   // thumbnail URL
}

function ensureHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

// ── NetEase Cloud Music (网易云音乐) ────────────────────────────────────
// type=100: artist search → picUrl / img1v1Url (artist photos)
// type=1:   song search   → album.picId → cover art via CDN
async function searchNetease(query: string): Promise<CoverSearchResult[]> {
  const results: CoverSearchResult[] = [];
  const seen = new Set<string>();

  // 1) Search artists first
  try {
    const artistUrl = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(query)}&type=100&offset=0&limit=10`;
    const res = await fetch(artistUrl, { headers: { Referer: 'https://music.163.com/' } });
    if (res.ok) {
      const data = await res.json();
      const artists = data?.result?.artists;
      if (Array.isArray(artists)) {
        for (const a of artists) {
          // picUrl is the artist's main photo
          const picUrl = a.picUrl as string | undefined;
          if (picUrl) {
            // NetEase allows appending ?param=WxH for resize
            const highRes = ensureHttps(picUrl) + '?param=600y600';
            const thumb = ensureHttps(picUrl) + '?param=200y200';
            if (!seen.has(highRes)) {
              seen.add(highRes);
              results.push({
                id: a.id ?? results.length,
                title: a.name ?? '',
                artist: a.name ?? '',
                album: '',
                artworkUrl: highRes,
                thumbUrl: thumb,
              });
            }
          }
          // img1v1Url is an alternate (usually square) photo
          const img1v1 = a.img1v1Url as string | undefined;
          if (img1v1 && !img1v1.includes('5639395138885805')) {
            // skip default placeholder
            const highRes = ensureHttps(img1v1) + '?param=600y600';
            if (!seen.has(highRes)) {
              seen.add(highRes);
              results.push({
                id: (a.id ?? 0) + 100000,
                title: a.name ?? '',
                artist: a.name ?? '',
                album: '',
                artworkUrl: highRes,
                thumbUrl: ensureHttps(img1v1) + '?param=200y200',
              });
            }
          }
        }
      }
    }
  } catch { /* fallthrough */ }

  // 2) Search songs → album cover art
  try {
    const songUrl = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(query)}&type=1&offset=0&limit=15`;
    const res = await fetch(songUrl, { headers: { Referer: 'https://music.163.com/' } });
    if (res.ok) {
      const data = await res.json();
      const songs = data?.result?.songs;
      if (Array.isArray(songs)) {
        for (const s of songs) {
          const albumId = s.album?.id;
          const albumPicId = s.album?.picId;
          if (!albumPicId) continue;
          // Build CDN URL from picId
          const coverUrl = `https://p1.music.126.net/${albumPicId}/${albumPicId}.jpg`;
          // Or use album detail which is more reliable
          const albumName = s.album?.name ?? '';
          const songArtist = s.artists?.[0]?.name ?? '';
          // Use a simpler, known-good CDN pattern
          const key = `album_${albumId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({
            id: albumId ?? results.length + 200000,
            title: s.name ?? '',
            artist: songArtist,
            album: albumName,
            artworkUrl: '', // fill below
            thumbUrl: '',
          });
        }
      }
    }
  } catch { /* fallthrough */ }

  // 3) For album results, fetch actual cover URLs
  const albumResults = results.filter(r => r.id >= 200000 || (!r.artworkUrl && r.album));
  for (const r of albumResults) {
    if (r.artworkUrl) continue;
    try {
      const detUrl = `https://music.163.com/api/album/${r.id}`;
      const res = await fetch(detUrl, { headers: { Referer: 'https://music.163.com/' } });
      if (res.ok) {
        const det = await res.json();
        const pic = det?.album?.picUrl || det?.album?.blurPicUrl;
        if (pic) {
          r.artworkUrl = ensureHttps(pic) + '?param=600y600';
          r.thumbUrl = ensureHttps(pic) + '?param=200y200';
        }
      }
    } catch { /* skip */ }
  }

  return results.filter(r => !!r.artworkUrl);
}

// ── iTunes Search API ───────────────────────────────────────────────────
async function searchItunes(
  title: string,
  artist: string,
): Promise<CoverSearchResult[]> {
  try {
    const query = `${artist} ${title}`.trim();
    if (!query) return [];
    const params = new URLSearchParams({
      term: query,
      media: 'music',
      entity: 'song',
      limit: '15',
    });
    const response = await fetch(`https://itunes.apple.com/search?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    const seen = new Set<string>();
    const results: CoverSearchResult[] = [];
    for (const item of data.results) {
      const url100 = item.artworkUrl100 as string | undefined;
      if (!url100) continue;
      const highRes = url100.replace('100x100bb', '600x600bb');
      if (seen.has(highRes)) continue;
      seen.add(highRes);
      results.push({
        id: item.trackId ?? results.length,
        title: item.trackName ?? '',
        artist: item.artistName ?? '',
        album: item.collectionName ?? '',
        artworkUrl: highRes,
        thumbUrl: url100,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ── Public entry point ──────────────────────────────────────────────────
export async function searchCoverArt(
  title: string,
  artist: string,
): Promise<CoverSearchResult[]> {
  const isChinese = i18n.language?.startsWith('zh');

  if (isChinese) {
    // Chinese → NetEase Cloud Music (best for Chinese artists)
    const query = (artist || title).trim();
    if (!query) return [];
    const results = await searchNetease(query);
    if (results.length > 0) return results;
    // Fallback to iTunes
    return searchItunes(title, artist);
  }

  // Non-Chinese → iTunes (reliable global coverage)
  const results = await searchItunes(title, artist);
  if (results.length > 0) return results;
  // Fallback to NetEase for Asian artists
  const query = (artist || title).trim();
  return query ? searchNetease(query) : [];
}

/**
 * Download a cover image and save to artwork cache.
 * Returns the local file:// URI on success.
 */
export async function downloadCoverArt(
  trackId: string,
  imageUrl: string,
): Promise<string | undefined> {
  try {
    const url = ensureHttps(imageUrl);
    const headers: Record<string, string> = {};
    // NetEase CDN requires Referer
    if (url.includes('music.126.net')) {
      headers.Referer = 'https://music.163.com/';
    }
    const response = await fetch(url, { headers });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    if (!base64) return undefined;
    const dataUri = `data:image/jpeg;base64,${base64}`;
    return saveArtworkFile(trackId, dataUri);
  } catch {
    return undefined;
  }
}

function blobToBase64(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIdx = result?.indexOf(',');
      resolve(commaIdx >= 0 ? result.substring(commaIdx + 1) : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Download cover image to a temp file for native writing.
 * Returns the temp file path on success.
 */
export async function downloadCoverToFile(imageUrl: string): Promise<string | undefined> {
  try {
    const url = ensureHttps(imageUrl);
    const headers: Record<string, string> = {};
    if (url.includes('music.126.net')) {
      headers.Referer = 'https://music.163.com/';
    }
    const tmpPath = `${RNFS.CachesDirectoryPath}/cover_download_tmp.jpg`;
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tmpPath,
      headers,
    }).promise;
    if (result.statusCode === 200) return tmpPath;
    return undefined;
  } catch {
    return undefined;
  }
}
