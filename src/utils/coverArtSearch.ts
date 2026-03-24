// src/utils/coverArtSearch.ts
// Chinese → NetEase Cloud Music API  |  Others → iTunes API  |  Fallback → Bing Image Search
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

// ── Bing Image Search ───────────────────────────────────────────────────
// Searches Bing Images for artist/song artwork. Extracts high-resolution
// image URLs from the HTML response's embedded JSON metadata.
const BING_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Referer': 'https://cn.bing.com/',
};

async function searchBing(artist: string): Promise<CoverSearchResult[]> {
  const query = artist.trim();
  if (!query) return [];

  const results: CoverSearchResult[] = [];
  const seen = new Set<string>();

  try {
    const apiUrl = `https://cn.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=35&mmasync=1`;
    const res = await fetch(apiUrl, { headers: BING_HEADERS });
    if (!res.ok) return [];

    const html = await res.text();

    // Strategy 1: Extract from m="..." attribute JSON metadata
    //   Each image result has m="{&quot;murl&quot;:&quot;...&quot;,&quot;turl&quot;:&quot;...&quot;,...}"
    //   murl = original full-size image URL
    //   turl = Bing thumbnail proxy (always accessible, e.g. https://ts*.mm.bing.net/th?id=...)
    const murlRegex = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;
    const turlRegex = /turl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;

    // Collect all murls
    const murls: string[] = [];
    let m;
    while ((m = murlRegex.exec(html)) !== null) {
      murls.push(m[1]);
    }

    // Collect all turls
    const turls: string[] = [];
    while ((m = turlRegex.exec(html)) !== null) {
      turls.push(m[1]);
    }

    for (let i = 0; i < murls.length; i++) {
      const murl = murls[i];
      if (seen.has(murl)) continue;
      seen.add(murl);

      // Use Bing thumbnail proxy as thumbUrl (always works, no CORS issues)
      // Append size params for high-quality display
      let thumbUrl = turls[i] || murl;
      if (thumbUrl.includes('bing.net/th')) {
        thumbUrl += '&w=200&h=200&c=7';
      }

      // For artworkUrl (full download), use the original murl
      results.push({
        id: results.length + 300000,
        title: query,
        artist: query,
        album: '',
        artworkUrl: murl,
        thumbUrl,
      });
      if (results.length >= 12) break;
    }

    // Strategy 2: If no murls found, extract from .mimg img src attributes
    if (results.length === 0) {
      const imgSrcRegex = /<img[^>]*class="mimg[^"]*"[^>]*src="(https?:\/\/[^"]+)"/g;
      while ((m = imgSrcRegex.exec(html)) !== null) {
        const url = m[1].replace(/&amp;/g, '&');
        if (seen.has(url)) continue;
        seen.add(url);
        // These are Bing proxy thumbnails; get high-res version
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
        if (results.length >= 12) break;
      }
    }
  } catch { /* fallthrough */ }

  return results;
}

// ── Public entry point ──────────────────────────────────────────────────
export async function searchCoverArt(
  title: string,
  artist: string,
): Promise<CoverSearchResult[]> {
  const isChinese = i18n.language?.startsWith('zh');
  const bingQuery = (artist || title).trim();
  if (!bingQuery) return [];

  // Run Bing search in parallel with music API searches so results come fast
  const bingPromise = searchBing(bingQuery).catch(() => [] as CoverSearchResult[]);

  let musicResults: CoverSearchResult[] = [];
  if (isChinese) {
    musicResults = await searchNetease(bingQuery).catch(() => []);
    if (musicResults.length === 0) {
      musicResults = await searchItunes(title, artist).catch(() => []);
    }
  } else {
    musicResults = await searchItunes(title, artist).catch(() => []);
    if (musicResults.length === 0) {
      musicResults = await searchNetease(bingQuery).catch(() => []);
    }
  }

  const bingResults = await bingPromise;

  // Merge: music API results first, then Bing results
  if (musicResults.length > 0) {
    // Deduplicate by artworkUrl
    const seen = new Set(musicResults.map(r => r.artworkUrl));
    const extra = bingResults.filter(r => !seen.has(r.artworkUrl));
    return [...musicResults, ...extra];
  }

  return bingResults;
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
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (url.includes('music.126.net')) {
      headers.Referer = 'https://music.163.com/';
    }
    const tmpPath = `${RNFS.CachesDirectoryPath}/cover_dl_${Date.now()}.jpg`;
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tmpPath,
      headers,
    }).promise;
    if (result.statusCode !== 200 || result.bytesWritten < 1000) {
      // File too small or failed — clean up
      await RNFS.unlink(tmpPath).catch(() => {});
      return undefined;
    }
    // Read as base64 and save to artwork cache
    const base64Data = await RNFS.readFile(tmpPath, 'base64');
    await RNFS.unlink(tmpPath).catch(() => {});
    if (!base64Data) return undefined;
    const dataUri = `data:image/jpeg;base64,${base64Data}`;
    return saveArtworkFile(trackId, dataUri);
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
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (url.includes('music.126.net')) {
      headers.Referer = 'https://music.163.com/';
    }
    const tmpPath = `${RNFS.CachesDirectoryPath}/cover_download_tmp.jpg`;
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tmpPath,
      headers,
    }).promise;
    if (result.statusCode === 200 && result.bytesWritten >= 1000) return tmpPath;
    await RNFS.unlink(tmpPath).catch(() => {});
    return undefined;
  } catch {
    return undefined;
  }
}
