import { Track } from '../types';

// 按文件扩展名推断音质等级（无损 > 有损高码率格式 > 有损低码率格式）
const qualityScore = (filePath: string): number => {
  const ext = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'flac': return 100;
    case 'wav': return 95;
    case 'aiff': case 'aif': return 90;
    case 'm4a': case 'aac': return 60;
    case 'ogg': case 'opus': return 55;
    case 'mp3': return 50;
    case 'wma': return 40;
    default: return 30;
  }
};

/**
 * 去重：同名+同歌手只保留一首
 * 优先级：有封面 > 音质高 > 先出现
 */
export function deduplicateTracks(tracks: Track[]): Track[] {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = `${t.title.trim().toLowerCase()}\0${t.artist.trim().toLowerCase()}`;
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  const result: Track[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      result.push(arr[0]);
    } else {
      arr.sort((a, b) => {
        const artA = a.artwork ? 1 : 0;
        const artB = b.artwork ? 1 : 0;
        if (artA !== artB) return artB - artA;
        return qualityScore(b.filePath) - qualityScore(a.filePath);
      });
      result.push(arr[0]);
    }
  }
  return result;
}
