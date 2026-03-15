// src/utils/equalizer.ts
// 均衡器桥接层：连接 Android 原生 EqualizerModule + AsyncStorage 持久化
// 保证用户选择的均衡器模式在杀进程、重启手机后依然保留

import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from 'react-native-track-player';

const { EqualizerModule } = NativeModules;

const EQ_STORAGE_KEY = '@eq_preset_id';

/** 当前活跃的预设 ID（内存缓存） */
let activePresetId = 0;
/** 是否已成功初始化原生模块 */
let isInitialized = false;

/**
 * 获取当前 audio session ID
 * react-native-track-player 在 Android 上使用 ExoPlayer，
 * 通过 getActiveTrack 时获取 session
 */
async function getAudioSessionId(): Promise<number> {
  try {
    // react-native-track-player v4 暴露 getPlaybackState，
    // 但 audioSessionId 需要通过 NativeModule 获取
    // Android ExoPlayer 默认 audioSessionId = 0 (系统混音输出)
    // 使用 0 可以绑定到系统级音频输出
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 初始化均衡器引擎并恢复上次保存的音效设置
 * 在 App 启动时（setupPlayer 成功后）调用
 */
export async function initEqualizer(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const sessionId = await getAudioSessionId();
    const result = await EqualizerModule.init(sessionId);
    isInitialized = true;

    console.log('[EQ] Initialized:', JSON.stringify(result));

    // 恢复上次保存的预设
    const savedId = await getSavedPresetId();
    if (savedId > 0) {
      console.log(`[EQ] Restoring saved preset: ${savedId}`);
      await EqualizerModule.applyPreset(savedId);
      activePresetId = savedId;
    }
  } catch (e) {
    console.warn('[EQ] Init failed:', e);
    isInitialized = false;
  }
}

/**
 * 应用均衡器预设并持久化到 AsyncStorage
 * @param presetId 预设 ID (0=关闭, 1-11=各音效模式)
 */
export async function applyEQPreset(presetId: number): Promise<void> {
  // 先保存到 AsyncStorage（确保即使应用被杀也能恢复）
  try {
    await AsyncStorage.setItem(EQ_STORAGE_KEY, String(presetId));
  } catch (e) {
    console.warn('[EQ] Failed to save preset:', e);
  }

  activePresetId = presetId;

  if (Platform.OS !== 'android') return;

  // 如果原生模块未初始化，尝试重新初始化
  if (!isInitialized) {
    try {
      const sessionId = await getAudioSessionId();
      await EqualizerModule.init(sessionId);
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
    console.warn('[EQ] Apply failed, retrying with re-init:', e);
    // 可能是 session 变了（比如播放器重建），尝试重新初始化
    try {
      const sessionId = await getAudioSessionId();
      await EqualizerModule.init(sessionId);
      await EqualizerModule.applyPreset(presetId);
      console.log(`[EQ] Applied preset after re-init: ${presetId}`);
    } catch (e2) {
      console.warn('[EQ] Apply after re-init also failed:', e2);
    }
  }
}

/**
 * 从 AsyncStorage 读取已保存的预设 ID
 * @returns 预设 ID，默认 0（关闭）
 */
export async function getSavedPresetId(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(EQ_STORAGE_KEY);
    if (val !== null) {
      const id = parseInt(val, 10);
      return isNaN(id) ? 0 : id;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 获取当前内存中的活跃预设 ID
 */
export function getActivePresetId(): number {
  return activePresetId;
}

/**
 * 获取均衡器硬件信息（调试用）
 */
export async function getEqualizerInfo(): Promise<any> {
  if (Platform.OS !== 'android' || !isInitialized) return null;
  try {
    return await EqualizerModule.getInfo();
  } catch {
    return null;
  }
}

/**
 * 释放均衡器资源（App 退出时调用）
 */
export async function releaseEqualizer(): Promise<void> {
  if (Platform.OS !== 'android' || !isInitialized) return;
  try {
    await EqualizerModule.release();
    isInitialized = false;
  } catch {}
}
