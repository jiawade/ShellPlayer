// src/utils/mediaLibrary.ts
// iOS iTunes/iPod 音乐库桥接层
import { NativeModules, Platform } from 'react-native';
import { Track } from '../types';

const { MediaLibraryModule } = NativeModules;

/**
 * 请求 iOS 媒体库访问权限
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !MediaLibraryModule) return false;
  try {
    return await MediaLibraryModule.requestPermission();
  } catch {
    return false;
  }
}

/**
 * 获取当前媒体库权限状态
 */
export async function getMediaLibraryPermissionStatus(): Promise<string> {
  if (Platform.OS !== 'ios' || !MediaLibraryModule) return 'unavailable';
  try {
    return await MediaLibraryModule.getPermissionStatus();
  } catch {
    return 'unavailable';
  }
}

// 导出缓存：避免重复导出同一首歌
const exportCache = new Map<string, string>();

/**
 * 将 ipod-library:// URL 导出为本地 file:// URL
 * 使用 AVAssetExportSession passthrough（不重编码，几乎瞬间完成）
 */
export async function exportTrackToFile(ipodUrl: string): Promise<string> {
  if (!ipodUrl.startsWith('ipod-library://')) return ipodUrl;
  if (exportCache.has(ipodUrl)) return exportCache.get(ipodUrl)!;
  if (Platform.OS !== 'ios' || !MediaLibraryModule) return ipodUrl;

  try {
    const localUrl: string = await MediaLibraryModule.exportToFile(ipodUrl);
    if (localUrl && localUrl.startsWith('file://')) {
      exportCache.set(ipodUrl, localUrl);
      return localUrl;
    }
    return ipodUrl;
  } catch {
    return ipodUrl;
  }
}

/**
 * 从音频文件 URL 读取内嵌歌词（M4A ©lyr / MP3 USLT）
 * 使用 AVURLAsset 元数据读取，比 MPMediaItemPropertyLyrics 更可靠
 */
export async function getLyricsForUrl(url: string): Promise<string | null> {
  if (Platform.OS !== 'ios' || !MediaLibraryModule) return null;
  try {
    const result = await MediaLibraryModule.getLyricsForUrl(url);
    return result && typeof result === 'string' && result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * 从 iTunes/iPod 音乐库导入所有本地歌曲
 */
export async function importFromMediaLibrary(): Promise<Track[]> {
  if (Platform.OS !== 'ios' || !MediaLibraryModule) return [];

  try {
    const items: any[] = await MediaLibraryModule.getAllSongs();
    const tracks: Track[] = items.map(item => ({
      id: item.id,
      url: item.url,
      title: item.title || '未知歌曲',
      artist: item.artist || '未知歌手',
      album: item.album || '未知专辑',
      artwork: item.artwork || undefined,
      duration: item.duration ? Number(item.duration) : undefined,
      fileName: item.fileName || item.title || '',
      filePath: item.filePath || item.url,
      isFavorite: false,
      embeddedLyrics: item.lyrics || undefined,
      year: item.year || undefined,
      genre: item.genre || undefined,
      trackNumber: item.trackNumber || undefined,
      composer: item.composer || undefined,
      comment: item.comment || undefined,
    }));

    tracks.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    return tracks;
  } catch (e) {
    console.warn('[MediaLibrary] Import failed:', e);
    return [];
  }
}
