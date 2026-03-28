// src/utils/defaultDirs.ts
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

export const getDefaultMusicDir = (): string => {
  if (Platform.OS === 'ios') {
    return `${RNFS.DocumentDirectoryPath}/music`;
  }
  return `${RNFS.ExternalDirectoryPath}/music`;
};

export const getDefaultLrcDir = (): string => {
  if (Platform.OS === 'ios') {
    return `${RNFS.DocumentDirectoryPath}/lrc`;
  }
  return `${RNFS.ExternalDirectoryPath}/lrc`;
};

export async function ensureDefaultDirs(): Promise<void> {
  const musicDir = getDefaultMusicDir();
  const lrcDir = getDefaultLrcDir();
  try {
    if (!(await RNFS.exists(musicDir))) {
      await RNFS.mkdir(musicDir);
    }
  } catch {}
  try {
    if (!(await RNFS.exists(lrcDir))) {
      await RNFS.mkdir(lrcDir);
    }
  } catch {}
}

export const IOS_HIDDEN_DIR_NAMES = ['lrc', 'ShellPlayer_logs'];
