// src/utils/equalizer.ts
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { EqualizerModule } = NativeModules;

const EQ_STORAGE_KEY = '@eq_preset_id';

let activePresetId = 0;
let isInitialized = false;

export async function initEqualizer(): Promise<void> {
  if (!EqualizerModule) return;

  try {
    const result = await EqualizerModule.init(0);
    isInitialized = true;
    console.log('[EQ] Initialized:', JSON.stringify(result));

    const savedId = await getSavedPresetId();
    if (savedId > 0) {
      await EqualizerModule.applyPreset(savedId);
      activePresetId = savedId;
      console.log(`[EQ] Restored preset: ${savedId}`);
    }
  } catch (e) {
    console.warn('[EQ] Init failed:', e);
    isInitialized = false;
  }
}

export async function rebindEqualizer(): Promise<void> {
  if (!EqualizerModule) return;
  if (activePresetId === 0) return;

  try {
    const result = await EqualizerModule.init(0);
    isInitialized = true;

    if (activePresetId > 0) {
      await EqualizerModule.applyPreset(activePresetId);
    }
    console.log(`[EQ] Rebound with preset ${activePresetId}, session: ${result?.sessionId}`);
  } catch (e) {
    console.warn('[EQ] Rebind failed:', e);
  }
}

export async function applyEQPreset(presetId: number): Promise<void> {
  activePresetId = presetId;

  try {
    await AsyncStorage.setItem(EQ_STORAGE_KEY, String(presetId));
  } catch {}

  if (!EqualizerModule) return;

  if (!isInitialized) {
    try {
      await EqualizerModule.init(0);
      isInitialized = true;
    } catch (e) {
      console.warn('[EQ] Re-init failed:', e);
      return;
    }
  }

  try {
    await EqualizerModule.applyPreset(presetId);
    console.log(`[EQ] Applied preset: ${presetId}`);
  } catch (e) {
    console.warn('[EQ] Apply failed:', e);
  }
}

export async function getSavedPresetId(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(EQ_STORAGE_KEY);
    if (val !== null) { const id = parseInt(val, 10); return isNaN(id) ? 0 : id; }
    return 0;
  } catch { return 0; }
}
