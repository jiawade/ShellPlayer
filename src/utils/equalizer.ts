// src/utils/equalizer.ts
// 均衡器桥接层：连接 Android 原生 EqualizerModule + AsyncStorage 持久化
// 在播放开始后重新绑定 audio session，确保音效生效

import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { EqualizerModule } = NativeModules;

const EQ_STORAGE_KEY = '@eq_preset_id';

let activePresetId = 0;
let isInitialized = false;

/**
 * 初始化均衡器引擎并恢复上次保存的音效设置
 * 在 App 启动时（setupPlayer 成功后）调用
 */
export async function initEqualizer(): Promise<void> {
  if (Platform.OS !== 'android' || !EqualizerModule) return;

  try {
    // 初始化时使用 session 0（全局），后续播放时会 rebind 到实际 session
    const result = await EqualizerModule.init(0);
    isInitialized = true;
    console.log('[EQ] Initialized:', JSON.stringify(result));

    // 恢复上次保存的预设
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

/**
 * 在播放开始后调用，重新绑定 EQ 到实际的音频 session
 * react-native-track-player 的 ExoPlayer 播放后会产生有效的 audio session
 * 此方法会尝试重新创建音效引擎绑定到新 session，并重新应用当前预设
 */
export async function rebindEqualizer(): Promise<void> {
  if (Platform.OS !== 'android' || !EqualizerModule) return;
  if (activePresetId === 0) return; // 关闭状态不需要 rebind

  try {
    // 重新初始化，让原生层检测新的 audio session
    const result = await EqualizerModule.init(0);
    isInitialized = true;

    // 重新应用当前预设
    if (activePresetId > 0) {
      await EqualizerModule.applyPreset(activePresetId);
    }
    console.log(`[EQ] Rebound with preset ${activePresetId}, session: ${result?.sessionId}`);
  } catch (e) {
    console.warn('[EQ] Rebind failed:', e);
  }
}

/**
 * 应用均衡器预设并持久化到 AsyncStorage
 * @param presetId 预设 ID (0=关闭, 1-11=各音效模式)
 */
export async function applyEQPreset(presetId: number): Promise<void> {
  activePresetId = presetId;

  try {
    await AsyncStorage.setItem(EQ_STORAGE_KEY, String(presetId));
  } catch {}

  if (Platform.OS !== 'android' || !EqualizerModule) return;

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


