// src/utils/audioLevel.ts
import {NativeModules, NativeEventEmitter, Platform, PermissionsAndroid} from 'react-native';

const {AudioLevelModule} = NativeModules;

let emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter {
  if (!emitter) {
    emitter = new NativeEventEmitter(AudioLevelModule);
  }
  return emitter;
}

export interface AudioLevelEvent {
  levels: number[]; // 16 band levels, each 0..1
  overall: number;  // overall RMS level 0..1
}

async function requestAndroidAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: '音频权限',
        message: '律动灯需要音频数据权限以显示实时节奏效果',
        buttonPositive: '确定',
        buttonNegative: '取消',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function startAudioLevelMonitoring(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidAudioPermission();
      if (!hasPermission) {
        console.warn('[AudioLevel] RECORD_AUDIO permission denied');
        return false;
      }
    }
    return await AudioLevelModule.startMonitoring();
  } catch (e) {
    console.warn('[AudioLevel] startMonitoring failed:', e);
    return false;
  }
}

export async function stopAudioLevelMonitoring(): Promise<void> {
  try {
    await AudioLevelModule.stopMonitoring();
  } catch (e) {
    console.warn('[AudioLevel] stopMonitoring failed:', e);
  }
}

export function addAudioLevelListener(
  callback: (event: AudioLevelEvent) => void,
): () => void {
  const sub = getEmitter().addListener('onAudioLevels', callback);
  return () => sub.remove();
}
