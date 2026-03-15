// src/types/index.ts

export interface Track {
  id: string;
  url: string;
  title: string;
  artist: string;
  album: string;
  artwork?: string;
  duration?: number;
  fileName: string;
  filePath: string;
  isFavorite: boolean;
  lrcPath?: string;
  embeddedLyrics?: string;  // 内嵌歌词 (USLT)
}

export interface LyricLine {
  time: number;
  text: string;
}

export type RepeatMode = 'off' | 'track' | 'queue';
