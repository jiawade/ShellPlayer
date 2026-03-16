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
    }));

    tracks.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    return tracks;
  } catch (e) {
    console.warn('[MediaLibrary] Import failed:', e);
    return [];
  }
}
