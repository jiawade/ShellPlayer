import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Playlist } from '../types';

interface PlaylistState {
  playlists: Playlist[];
}

const initialState: PlaylistState = {
  playlists: [],
};

export const loadPlaylists = createAsyncThunk('playlist/load', async () => {
  try {
    const data = await AsyncStorage.getItem('@playlists');
    return data ? (JSON.parse(data) as Playlist[]) : [];
  } catch {
    return [];
  }
});

const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {
    createPlaylist: (s, a: PayloadAction<string>) => {
      const now = Date.now();
      s.playlists.push({
        id: `pl_${now}_${Math.random().toString(36).slice(2, 8)}`,
        name: a.payload,
        trackIds: [],
        createdAt: now,
        updatedAt: now,
      });
    },
    renamePlaylist: (s, a: PayloadAction<{ id: string; name: string }>) => {
      const pl = s.playlists.find(p => p.id === a.payload.id);
      if (pl) {
        pl.name = a.payload.name;
        pl.updatedAt = Date.now();
      }
    },
    deletePlaylist: (s, a: PayloadAction<string>) => {
      s.playlists = s.playlists.filter(p => p.id !== a.payload);
    },
    addTracksToPlaylist: (s, a: PayloadAction<{ playlistId: string; trackIds: string[] }>) => {
      const pl = s.playlists.find(p => p.id === a.payload.playlistId);
      if (pl) {
        const existing = new Set(pl.trackIds);
        for (const id of a.payload.trackIds) {
          if (!existing.has(id)) {
            pl.trackIds.push(id);
            existing.add(id);
          }
        }
        pl.updatedAt = Date.now();
      }
    },
    removeTracksFromPlaylist: (s, a: PayloadAction<{ playlistId: string; trackIds: string[] }>) => {
      const pl = s.playlists.find(p => p.id === a.payload.playlistId);
      if (pl) {
        const toRemove = new Set(a.payload.trackIds);
        pl.trackIds = pl.trackIds.filter(id => !toRemove.has(id));
        pl.updatedAt = Date.now();
      }
    },
    reorderPlaylist: (s, a: PayloadAction<{ playlistId: string; trackIds: string[] }>) => {
      const pl = s.playlists.find(p => p.id === a.payload.playlistId);
      if (pl) {
        pl.trackIds = a.payload.trackIds;
        pl.updatedAt = Date.now();
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadPlaylists.fulfilled, (s, a) => {
      s.playlists = a.payload;
    });
  },
});

export const {
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  reorderPlaylist,
} = playlistSlice.actions;

export default playlistSlice.reducer;
