// src/utils/equalizer.ts
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { EqualizerModule, TrackPlayerModule } = NativeModules;

const EQ_STORAGE_KEY = '@eq_preset_id';

let activePresetId = 0;
let isInitialized = false;
let currentSessionId = 0;

async function getAndroidSessionId(): Promise<number> {
  if (Platform.OS !== 'android' || !TrackPlayerModule) return 0;
  try {
    return await TrackPlayerModule.getAudioSessionId();
  } catch {
    return 0;
  }
}

export async function initEqualizer(): Promise<void> {
  if (!EqualizerModule) return;

  try {
    const sessionId = await getAndroidSessionId();
    const result = await EqualizerModule.init(sessionId);
    isInitialized = true;
    currentSessionId = result?.sessionId || sessionId;

    const savedId = await getSavedPresetId();
    if (savedId === -1) {
      // Restore custom bands
      const custom = await getSavedCustomBands();
      if (custom) {
        await EqualizerModule.setCustomBands(custom);
        activePresetId = -1;
      }
    } else if (savedId > 0) {
      await EqualizerModule.applyPreset(savedId);
      activePresetId = savedId;
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
    const sessionId = await getAndroidSessionId();
    // 如果 sessionId 没变，native 层会跳过重复初始化
    const result = await EqualizerModule.init(sessionId);
    isInitialized = true;
    currentSessionId = result?.sessionId || sessionId;

    if (activePresetId > 0) {
      await EqualizerModule.applyPreset(activePresetId);
    }
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
      const sessionId = await getAndroidSessionId();
      await EqualizerModule.init(sessionId);
      isInitialized = true;
    } catch (e) {
      console.warn('[EQ] Re-init failed:', e);
      return;
    }
  }

  try {
    await EqualizerModule.applyPreset(presetId);
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

const EQ_CUSTOM_KEY = '@eq_custom_bands';

export async function applyCustomBands(gains: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EQ_CUSTOM_KEY, JSON.stringify(gains));
    await AsyncStorage.setItem(EQ_STORAGE_KEY, '-1');
  } catch {}

  activePresetId = -1;
  if (!EqualizerModule) return;

  if (!isInitialized) {
    try {
      const sessionId = await getAndroidSessionId();
      await EqualizerModule.init(sessionId);
      isInitialized = true;
    } catch { return; }
  }

  try {
    await EqualizerModule.setCustomBands(gains);
  } catch (e) {
    console.warn('[EQ] setCustomBands failed:', e);
  }
}

export async function getSavedCustomBands(): Promise<number[] | null> {
  try {
    const val = await AsyncStorage.getItem(EQ_CUSTOM_KEY);
    if (val) return JSON.parse(val);
    return null;
  } catch { return null; }
}

// Band info for parametric UI
// iOS: 10 bands  Android: 5 bands (device-dependent)
export const IOS_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const ANDROID_BANDS = [60, 230, 910, 3600, 14000];

export function getDefaultBands(): number[] {
  return Platform.OS === 'ios'
    ? new Array(10).fill(0)
    : new Array(5).fill(0);
}

export function getBandFrequencies(): number[] {
  return Platform.OS === 'ios' ? IOS_BANDS : ANDROID_BANDS;
}
