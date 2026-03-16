// src/utils/permissions.ts
import { Platform, PermissionsAndroid } from 'react-native';
import { requestMediaLibraryPermission } from './mediaLibrary';

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return requestMediaLibraryPermission();
  }
  if (Platform.OS !== 'android') return true;

  try {
    const apiLevel = Platform.Version;
    if (typeof apiLevel === 'number' && apiLevel >= 33) {
      const granted = await PermissionsAndroid.request(
        'android.permission.READ_MEDIA_AUDIO' as any,
        {
          title: '音乐文件访问权限',
          message: '需要访问您设备上的音乐文件来扫描本地音乐',
          buttonNeutral: '稍后再说',
          buttonNegative: '拒绝',
          buttonPositive: '允许',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: '存储访问权限',
          message: '需要访问您的存储空间来扫描本地音乐',
          buttonNeutral: '稍后再说',
          buttonNegative: '拒绝',
          buttonPositive: '允许',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (err) {
    console.warn('权限请求失败:', err);
    return false;
  }
}
