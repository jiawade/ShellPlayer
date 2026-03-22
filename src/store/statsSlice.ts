// src/store/statsSlice.ts
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STATS_KEY = '@play_stats';

interface StatsState {
  dailyListenTime: Record<string, number>;   // "2026-03-22" → seconds
  trackPlayCounts: Record<string, number>;    // trackId → count
  artistPlayTime: Record<string, number>;     // artistName → seconds
}

const initialState: StatsState = {
  dailyListenTime: {},
  trackPlayCounts: {},
  artistPlayTime: {},
};

export const loadStats = createAsyncThunk('stats/load', async () => {
  const raw = await AsyncStorage.getItem(STATS_KEY);
  if (raw) return JSON.parse(raw) as StatsState;
  return initialState;
});

const today = () => new Date().toISOString().slice(0, 10);

const statsSlice = createSlice({
  name: 'stats',
  initialState,
  reducers: {
    recordListenTime(state, action: PayloadAction<{ trackId: string; artist: string; seconds: number }>) {
      const { trackId, artist, seconds } = action.payload;
      const d = today();
      state.dailyListenTime[d] = (state.dailyListenTime[d] || 0) + seconds;
      state.trackPlayCounts[trackId] = (state.trackPlayCounts[trackId] || 0) + 1;
      if (artist) {
        state.artistPlayTime[artist] = (state.artistPlayTime[artist] || 0) + seconds;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadStats.fulfilled, (_state, action) => {
      return action.payload;
    });
  },
});

export const { recordListenTime } = statsSlice.actions;
export default statsSlice.reducer;
