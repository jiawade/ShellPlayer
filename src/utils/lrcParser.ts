// src/utils/lrcParser.ts
import { LyricLine } from '../types';

/**
 * 解析 LRC 歌词文件内容
 */
export function parseLRC(lrcContent: string): LyricLine[] {
  if (!lrcContent || lrcContent.trim().length === 0) return [];

  const lines = lrcContent.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\[[a-z]+:/.test(trimmed)) continue;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let ms = 0;
      if (match[3]) {
        const s = match[3];
        ms = s.length === 1 ? parseInt(s) * 100
           : s.length === 2 ? parseInt(s) * 10
           : parseInt(s);
      }
      timestamps.push(minutes * 60 + seconds + ms / 1000);
      lastIndex = timeRegex.lastIndex;
    }

    if (timestamps.length === 0) continue;
    const text = trimmed.substring(lastIndex).trim();
    if (!text) continue;

    for (const time of timestamps) {
      result.push({ time, text });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * 解析纯文本歌词（无时间戳）
 * 每行均匀分配时间，以便展示和基本滚动
 */
export function parseTextLyrics(text: string, duration?: number): LyricLine[] {
  if (!text || text.trim().length === 0) return [];
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  if (lines.length === 0) return [];

  const totalTime = duration && duration > 0 ? duration : lines.length * 4;
  const interval = totalTime / lines.length;

  return lines.map((line, i) => ({
    time: i * interval,
    text: line,
  }));
}

/**
 * 二分查找当前歌词索引
 * 找到满足 lyrics[i].time <= currentTime < lyrics[i+1].time 的 i
 */
export function findCurrentLyricIndex(
  lyrics: LyricLine[],
  currentTime: number,
): number {
  if (lyrics.length === 0) return -1;
  if (currentTime < lyrics[0].time) return -1;

  let low = 0;
  let high = lyrics.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lyrics[mid].time <= currentTime) {
      if (mid === lyrics.length - 1 || lyrics[mid + 1].time > currentTime) {
        return mid;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return -1;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
