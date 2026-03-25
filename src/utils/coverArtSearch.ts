// src/utils/coverArtSearch.ts
import RNFS from 'react-native-fs';
import {saveArtworkFile} from './artworkCache';

export interface CoverSearchResult {
  id: number;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string; // high-res URL
  thumbUrl: string; // thumbnail URL
}

function ensureHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Detect image format from base64 header bytes.
 */
function detectImageFormat(base64Data: string): string {
  // Check first few bytes for magic headers
  const header = base64Data.substring(0, 16);
  if (header.startsWith('/9j/')) {
    return 'jpg';
  }
  if (header.startsWith('iVBOR')) {
    return 'png';
  }
  if (header.startsWith('R0lGO')) {
    return 'gif';
  }
  if (header.startsWith('UklGR')) {
    return 'webp';
  }
  return 'unknown';
}

// ── Bing Image Search ───────────────────────────────────────────────────
// Searches Bing Images for artist/song artwork. Extracts high-resolution
// image URLs from the HTML response's embedded JSON metadata.
const BING_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  Referer: 'https://cn.bing.com/',
};

async function searchBing(artist: string): Promise<CoverSearchResult[]> {
  const query = artist.trim();
  if (!query) {
    return [];
  }

  const results: CoverSearchResult[] = [];
  const seen = new Set<string>();

  try {
    const apiUrl = `https://cn.bing.com/images/async?q=${encodeURIComponent(
      query,
    )}&first=0&count=35&mmasync=1`;
    const res = await fetch(apiUrl, {headers: BING_HEADERS});
    if (!res.ok) {
      return [];
    }

    const html = await res.text();

    const murlRegex = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;
    const turlRegex = /turl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;

    const murls: string[] = [];
    let m;
    while ((m = murlRegex.exec(html)) !== null) {
      murls.push(m[1]);
    }

    const turls: string[] = [];
    while ((m = turlRegex.exec(html)) !== null) {
      turls.push(m[1]);
    }

    for (let i = 0; i < murls.length; i++) {
      const murl = murls[i];
      if (seen.has(murl)) {
        continue;
      }
      seen.add(murl);

      let thumbUrl = turls[i] || murl;
      if (thumbUrl.includes('bing.net/th')) {
        thumbUrl += '&w=200&h=200&c=7';
      }

      results.push({
        id: results.length + 300000,
        title: query,
        artist: query,
        album: '',
        artworkUrl: murl,
        thumbUrl,
      });
      if (results.length >= 12) {
        break;
      }
    }

    // Strategy 2: If no murls found, extract from .mimg img src attributes
    if (results.length === 0) {
      const imgSrcRegex = /<img[^>]*class="mimg[^"]*"[^>]*src="(https?:\/\/[^"]+)"/g;
      while ((m = imgSrcRegex.exec(html)) !== null) {
        const url = m[1].replace(/&amp;/g, '&');
        if (seen.has(url)) {
          continue;
        }
        seen.add(url);
        const highRes = url.includes('bing.net/th')
          ? url.replace(/&w=\d+/, '&w=600').replace(/&h=\d+/, '&h=600') + '&w=600&h=600'
          : url;
        results.push({
          id: results.length + 300000,
          title: query,
          artist: query,
          album: '',
          artworkUrl: highRes,
          thumbUrl: url,
        });
        if (results.length >= 12) {
          break;
        }
      }
    }
  } catch {}

  return results;
}

// 只用Bing搜索，参数为歌手名（可手动输入）
export async function searchCoverArt(artist: string): Promise<CoverSearchResult[]> {
  const query = artist.trim();
  if (!query) {
    return [];
  }
  return searchBing(query).catch(() => [] as CoverSearchResult[]);
}

/**
 * Download a cover image and save to artwork cache.
 * Returns the local file:// URI on success.
 * Uses RNFS.downloadFile for reliable binary downloads with redirect support.
 */
export async function downloadCoverArt(
  trackId: string,
  imageUrl: string,
): Promise<string | undefined> {
  try {
    const url = ensureHttps(imageUrl);
    let origin = '';
    try {
      const u = new URL(url);
      origin = u.origin;
    } catch {}
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
    };
    if (origin) {
      headers.Referer = origin + '/';
    }
    const tmpPath = `${RNFS.CachesDirectoryPath}/cover_dl_${Date.now()}.jpg`;
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tmpPath,
      headers,
    }).promise;
    if (result.statusCode < 200 || result.statusCode >= 400 || result.bytesWritten < 1000) {
      await RNFS.unlink(tmpPath).catch(() => {});
      return undefined;
    }

    const base64Data = await RNFS.readFile(tmpPath, 'base64');
    if (!base64Data) {
      await RNFS.unlink(tmpPath).catch(() => {});
      return undefined;
    }

    const detectedFormat = detectImageFormat(base64Data);
    await RNFS.unlink(tmpPath).catch(() => {});

    const mimeType = detectedFormat === 'png' ? 'image/png' : 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    return await saveArtworkFile(trackId, dataUri);
  } catch {
    return undefined;
  }
}

/**
 * Download cover image to a temp file for native writing.
 * Returns the temp file path on success.
 */
export async function downloadCoverToFile(imageUrl: string): Promise<string | undefined> {
  try {
    const url = ensureHttps(imageUrl);
    let origin = '';
    try {
      const u = new URL(url);
      origin = u.origin;
    } catch {}
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
    };
    if (origin) {
      headers.Referer = origin + '/';
    }
    const tmpPath = `${RNFS.CachesDirectoryPath}/cover_download_tmp.jpg`;
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tmpPath,
      headers,
    }).promise;
    if (result.statusCode >= 200 && result.statusCode < 400 && result.bytesWritten >= 1000) {
      return tmpPath;
    }
    await RNFS.unlink(tmpPath).catch(() => {});
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 一键搜索+下载+保存封面（终极方案）
 * 1. Bing搜索歌手图片
 * 2. 随机选一张（最多尝试3张，有的URL可能无法下载）
 * 3. 下载并保存到 album 调试目录
 * 4. 保存到 artworkCache，返回 file:// URI
 * 5. 同时下载到临时文件供写入歌曲标签
 *
 * @returns { cachedUri, tmpPath } on success, undefined on failure
 */
export async function searchAndApplyCover(
  trackId: string,
  artist: string,
): Promise<{cachedUri: string; tmpPath?: string} | undefined> {
  // Step 1: Search
  const results = await searchBing(artist.trim()).catch(() => [] as CoverSearchResult[]);
  if (results.length === 0) {
    return undefined;
  }

  // Step 2: Try up to 3 random picks
  const maxAttempts = Math.min(3, results.length);
  const tried = new Set<number>();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * results.length);
    } while (tried.has(idx) && tried.size < results.length);
    tried.add(idx);

    const picked = results[idx];

    // Step 3: Download
    const cachedUri = await downloadCoverArt(trackId, picked.artworkUrl);
    if (!cachedUri) {
      continue;
    }

    // Step 4: Also download to tmp file for tag writing (best effort)
    let tmpPath: string | undefined;
    try {
      tmpPath = await downloadCoverToFile(picked.artworkUrl);
    } catch {}

    return {cachedUri, tmpPath};
  }

  return undefined;
}
