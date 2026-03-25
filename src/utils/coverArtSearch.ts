// src/utils/coverArtSearch.ts
// Chinese → NetEase Cloud Music API  |  Others → iTunes API  |  Fallback → Bing Image Search
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { saveArtworkFile } from './artworkCache';
import i18n from '../i18n';

// ── Cover Search Logger ─────────────────────────────────────────────────
const COVER_LOG_DIR =
  Platform.OS === 'ios'
    ? `${RNFS.DocumentDirectoryPath}/ShellPlayer_logs`
    : `${RNFS.ExternalDirectoryPath}/ShellPlayer_logs`;
const COVER_LOG_FILE = `${COVER_LOG_DIR}/cover.log`;
const COVER_LOG_MAX = 500 * 1024; // 500KB

async function coverLog(msg: string) {
  try {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    const dirExists = await RNFS.exists(COVER_LOG_DIR);
    if (!dirExists) await RNFS.mkdir(COVER_LOG_DIR);
    const exists = await RNFS.exists(COVER_LOG_FILE);
    if (exists) {
      const stat = await RNFS.stat(COVER_LOG_FILE);
      if (Number(stat.size) > COVER_LOG_MAX) {
        await RNFS.unlink(COVER_LOG_FILE);
        await RNFS.writeFile(COVER_LOG_FILE, '=== Cover Search Log (rotated) ===\n' + line, 'utf8');
        return;
      }
      await RNFS.appendFile(COVER_LOG_FILE, line, 'utf8');
    } else {
      await RNFS.writeFile(COVER_LOG_FILE, '=== Cover Search Log ===\n' + line, 'utf8');
    }
  } catch (e) {
    console.warn('[coverLog]', e);
  }
}

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
  coverLog(`[NetEase] START query="${query}"`);

  // 1) Search artists first
  try {
    const artistUrl = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(query)}&type=100&offset=0&limit=10`;
    coverLog(`[NetEase] artist search URL: ${artistUrl}`);
    const res = await fetch(artistUrl, { headers: { Referer: 'https://music.163.com/' } });
    coverLog(`[NetEase] artist search status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const artists = data?.result?.artists;
      coverLog(`[NetEase] artist count: ${Array.isArray(artists) ? artists.length : 0}`);
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
  } catch (e) { coverLog(`[NetEase] artist search ERROR: ${e}`); }
  // 2) Search songs → album cover art
  try {
    const songUrl = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(query)}&type=1&offset=0&limit=15`;
    coverLog(`[NetEase] song search URL: ${songUrl}`);
    const res = await fetch(songUrl, { headers: { Referer: 'https://music.163.com/' } });
    coverLog(`[NetEase] song search status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const songs = data?.result?.songs;
      coverLog(`[NetEase] song count: ${Array.isArray(songs) ? songs.length : 0}`);
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
  } catch (e) { coverLog(`[NetEase] song search ERROR: ${e}`); }

  // 3) For album results, fetch actual cover URLs
  const albumResults = results.filter(r => r.id >= 200000 || (!r.artworkUrl && r.album));
  coverLog(`[NetEase] album detail fetch needed: ${albumResults.length}`);
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
    } catch (e) { coverLog(`[NetEase] album ${r.id} detail ERROR: ${e}`); }
  }

  const final = results.filter(r => !!r.artworkUrl);
  coverLog(`[NetEase] END total=${final.length} (artist+song=${results.length}, withArt=${final.length})`);
  return final;
}

// ── iTunes Search API ───────────────────────────────────────────────────
async function searchItunes(
  title: string,
  artist: string,
): Promise<CoverSearchResult[]> {
  try {
    const query = `${artist} ${title}`.trim();
    if (!query) return [];
    coverLog(`[iTunes] START query="${query}"`);
    const params = new URLSearchParams({
      term: query,
      media: 'music',
      entity: 'song',
      limit: '15',
    });
    const url = `https://itunes.apple.com/search?${params}`;
    coverLog(`[iTunes] URL: ${url}`);
    const response = await fetch(url);
    coverLog(`[iTunes] status: ${response.status}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      coverLog(`[iTunes] no results array in response`);
      return [];
    }
    coverLog(`[iTunes] raw results: ${data.results.length}`);

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
    coverLog(`[iTunes] END total=${results.length}`);
    return results;
  } catch (e) {
    coverLog(`[iTunes] ERROR: ${e}`);
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
  coverLog(`[Bing] START query="${query}"`);

  const results: CoverSearchResult[] = [];
  const seen = new Set<string>();

  try {
    const apiUrl = `https://cn.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=35&mmasync=1`;
    coverLog(`[Bing] URL: ${apiUrl}`);
    const res = await fetch(apiUrl, { headers: BING_HEADERS });
    coverLog(`[Bing] status: ${res.status}`);
    if (!res.ok) { coverLog(`[Bing] non-ok response, abort`); return []; }

    const html = await res.text();
    coverLog(`[Bing] HTML length: ${html.length} chars`);

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
    coverLog(`[Bing] murls=${murls.length}, turls=${turls.length}`);
    if (murls.length > 0) coverLog(`[Bing] first murl: ${murls[0].substring(0, 120)}`);

    for (let i = 0; i < murls.length; i++) {
      const murl = murls[i];
      if (seen.has(murl)) continue;
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
      if (results.length >= 12) break;
    }

    // Strategy 2: If no murls found, extract from .mimg img src attributes
    if (results.length === 0) {
      coverLog(`[Bing] no murls, trying mimg fallback`);
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
  } catch (e) { coverLog(`[Bing] ERROR: ${e}`); }

  coverLog(`[Bing] END total=${results.length}`);
  return results;
}

// ── Public entry point ──────────────────────────────────────────────────
const GENERIC_ARTISTS = ['未知歌手', 'Unknown Artist', '未知艺术家', '<unknown>'];

export async function searchCoverArt(
  title: string,
  artist: string,
): Promise<CoverSearchResult[]> {
  const isChinese = i18n.language?.startsWith('zh');
  const isGenericArtist = !artist || GENERIC_ARTISTS.includes(artist.trim());
  // Use "title artist" for better results; skip generic artist names
  const fullQuery = isGenericArtist ? title.trim() : `${title} ${artist}`.trim();
  const artistQuery = isGenericArtist ? title.trim() : artist.trim();
  const bingQuery = isGenericArtist ? title.trim() : `${artist} ${title}`.trim();
  coverLog(`\n====== searchCoverArt START ======\ntitle="${title}" artist="${artist}" lang=${i18n.language} isChinese=${isChinese} fullQuery="${fullQuery}" bingQuery="${bingQuery}"`);
  if (!bingQuery) { coverLog(`[searchCoverArt] empty query, abort`); return []; }

  const bingPromise = searchBing(bingQuery).catch((e) => { coverLog(`[searchCoverArt] bing catch: ${e}`); return [] as CoverSearchResult[]; });

  let musicResults: CoverSearchResult[] = [];
  if (isChinese) {
    musicResults = await searchNetease(fullQuery).catch((e) => { coverLog(`[searchCoverArt] netease catch: ${e}`); return []; });
    coverLog(`[searchCoverArt] netease results: ${musicResults.length}`);
    if (musicResults.length === 0) {
      musicResults = await searchItunes(title, artist).catch((e) => { coverLog(`[searchCoverArt] itunes catch: ${e}`); return []; });
      coverLog(`[searchCoverArt] itunes fallback results: ${musicResults.length}`);
    }
  } else {
    musicResults = await searchItunes(title, artist).catch((e) => { coverLog(`[searchCoverArt] itunes catch: ${e}`); return []; });
    coverLog(`[searchCoverArt] itunes results: ${musicResults.length}`);
    if (musicResults.length === 0) {
      musicResults = await searchNetease(fullQuery).catch((e) => { coverLog(`[searchCoverArt] netease fallback catch: ${e}`); return []; });
      coverLog(`[searchCoverArt] netease fallback results: ${musicResults.length}`);
    }
  }

  const bingResults = await bingPromise;
  coverLog(`[searchCoverArt] bing results: ${bingResults.length}`);

  let merged: CoverSearchResult[];
  if (musicResults.length > 0) {
    const seen = new Set(musicResults.map(r => r.artworkUrl));
    const extra = bingResults.filter(r => !seen.has(r.artworkUrl));
    merged = [...musicResults, ...extra];
  } else {
    merged = bingResults;
  }

  coverLog(`[searchCoverArt] END merged total: ${merged.length}`);
  if (merged.length > 0) {
    coverLog(`[searchCoverArt] first result: artworkUrl=${merged[0].artworkUrl.substring(0, 120)} thumbUrl=${merged[0].thumbUrl.substring(0, 120)}`);
  }
  return merged;
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
  coverLog(`[download] START trackId="${trackId}" url="${imageUrl.substring(0, 120)}"`);
  try {
    const url = ensureHttps(imageUrl);
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    if (url.includes('music.126.net')) {
      headers.Referer = 'https://music.163.com/';
    }
    const tmpPath = `${RNFS.CachesDirectoryPath}/cover_dl_${Date.now()}.jpg`;
    coverLog(`[download] downloading to ${tmpPath}`);
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tmpPath,
      headers,
    }).promise;
    coverLog(`[download] status=${result.statusCode} bytes=${result.bytesWritten}`);
    if (result.statusCode !== 200 || result.bytesWritten < 1000) {
      coverLog(`[download] FAIL: status or size too small, cleaning up`);
      await RNFS.unlink(tmpPath).catch(() => {});
      return undefined;
    }
    const base64Data = await RNFS.readFile(tmpPath, 'base64');
    await RNFS.unlink(tmpPath).catch(() => {});
    if (!base64Data) { coverLog(`[download] FAIL: empty base64`); return undefined; }
    coverLog(`[download] base64 length=${base64Data.length}, saving to artwork cache`);
    const dataUri = `data:image/jpeg;base64,${base64Data}`;
    const saved = await saveArtworkFile(trackId, dataUri);
    coverLog(`[download] saved=${saved ? saved.substring(0, 80) : 'undefined'}`);
    return saved;
  } catch (e) {
    coverLog(`[download] ERROR: ${e}`);
    return undefined;
  }
}

/**
 * Download cover image to a temp file for native writing.
 * Returns the temp file path on success.
 */
export async function downloadCoverToFile(imageUrl: string): Promise<string | undefined> {
  coverLog(`[downloadToFile] START url="${imageUrl.substring(0, 120)}"`);
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
    coverLog(`[downloadToFile] status=${result.statusCode} bytes=${result.bytesWritten}`);
    if (result.statusCode === 200 && result.bytesWritten >= 1000) return tmpPath;
    coverLog(`[downloadToFile] FAIL`);
    await RNFS.unlink(tmpPath).catch(() => {});
    return undefined;
  } catch (e) {
    coverLog(`[downloadToFile] ERROR: ${e}`);
    return undefined;
  }
}
