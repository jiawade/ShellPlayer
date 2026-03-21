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
    if (savedId > 0) {
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
