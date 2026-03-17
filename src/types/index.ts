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
  embeddedLyrics?: string;
}

export interface LyricLine {
  time: number;
  text: string;
}

export type RepeatMode = 'off' | 'track' | 'queue';
export type SortMode = 'title' | 'artist' | 'recent';
export type ThemeMode = 'dark' | 'light';

export interface PlayHistoryEntry {
  trackId: string;
  playedAt: number; // timestamp
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}
