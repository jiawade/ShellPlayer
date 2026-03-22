// src/store/proSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { checkProStatus as checkPro } from '../utils/iap';

interface ProState {
  isPro: boolean;
  isLoading: boolean;
}

const initialState: ProState = {
  isPro: false,
  isLoading: true,
};

export const loadProStatus = createAsyncThunk('pro/loadStatus', async () => {
  return checkPro();
});

const proSlice = createSlice({
  name: 'pro',
  initialState,
  reducers: {
    setPro(state) {
      state.isPro = true;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProStatus.fulfilled, (state, action) => {
        state.isPro = action.payload;
        state.isLoading = false;
      })
      .addCase(loadProStatus.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const { setPro } = proSlice.actions;
export default proSlice.reducer;
