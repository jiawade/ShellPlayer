// src/utils/artworkCache.ts
import RNFS from 'react-native-fs';

const CACHE_DIR = `${RNFS.CachesDirectoryPath}/artwork`;
let dirReady = false;

async function ensureDir() {
  if (dirReady) return;
  try {
    if (!(await RNFS.exists(CACHE_DIR))) await RNFS.mkdir(CACHE_DIR);
    dirReady = true;
  } catch {}
}

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * 将 base64 data URI 保存为 jpg 文件，返回 file:// 路径
 */
export async function saveArtworkFile(trackId: string, dataUri: string): Promise<string | undefined> {
  await ensureDir();
  try {
    // 提取 base64 数据部分
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx < 0) return undefined;
    const base64Data = dataUri.substring(commaIdx + 1);
    const ext = dataUri.includes('image/png') ? 'png' : 'jpg';
    const fileName = `${hashKey(trackId)}.${ext}`;
    const filePath = `${CACHE_DIR}/${fileName}`;

    // 如果已存在就不重复写
    if (await RNFS.exists(filePath)) {
      return `file://${filePath}`;
    }

    await RNFS.writeFile(filePath, base64Data, 'base64');
    return `file://${filePath}`;
  } catch {
    return undefined;
  }
}

/**
 * 尝试获取已缓存的封面 file:// URI
 */
export async function getCachedArtwork(trackId: string): Promise<string | undefined> {
  const h = hashKey(trackId);
  // 尝试 jpg 和 png
  for (const ext of ['jpg', 'png']) {
    const p = `${CACHE_DIR}/${h}.${ext}`;
    try {
      if (await RNFS.exists(p)) return `file://${p}`;
    } catch {}
  }
  return undefined;
}

/**
 * 批量查找缓存封面：读一次目录，返回 trackId -> file:// URI 的 Map
 */
export async function batchGetCachedArtworks(trackIds: string[]): Promise<Map<string, string>> {
  await ensureDir();
  const result = new Map<string, string>();
  try {
    const files = await RNFS.readDir(CACHE_DIR);
    const fileSet = new Set(files.map(f => f.name));
    for (const id of trackIds) {
      const h = hashKey(id);
      for (const ext of ['jpg', 'png']) {
        const name = `${h}.${ext}`;
        if (fileSet.has(name)) {
          result.set(id, `file://${CACHE_DIR}/${name}`);
          break;
        }
      }
    }
  } catch {}
  return result;
}
