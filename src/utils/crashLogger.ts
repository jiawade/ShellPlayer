// src/utils/crashLogger.ts
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

const LOG_DIR =
  Platform.OS === 'ios'
    ? `${RNFS.DocumentDirectoryPath}/ShellPlayer_logs`
    : `${RNFS.ExternalDirectoryPath}/ShellPlayer_logs`;
const MAX_LOG_SIZE = 500 * 1024; // 500KB per file
const MAX_LOG_FILES = 5;

let initialized = false;

async function ensureLogDir() {
  if (initialized) {
    return;
  }
  try {
    const exists = await RNFS.exists(LOG_DIR);
    if (!exists) {
      await RNFS.mkdir(LOG_DIR);
    }
    initialized = true;
  } catch (e) {
    console.warn('Failed to create log dir:', e);
  }
}

function getTimestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds()}`;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

function getLogFileName(): string {
  const d = new Date();
  return `crash_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.log`;
}

async function rotateLogsIfNeeded() {
  try {
    const files = await RNFS.readDir(LOG_DIR);
    const logFiles = files
      .filter(f => f.name.endsWith('.log'))
      .sort((a, b) => ((a.mtime || 0) < (b.mtime || 0) ? -1 : 1));

    if (logFiles.length > MAX_LOG_FILES) {
      const toDelete = logFiles.slice(0, logFiles.length - MAX_LOG_FILES);
      for (const f of toDelete) {
        await RNFS.unlink(f.path);
      }
    }
  } catch {}
}

export async function logCrash(error: Error | string, context?: string) {
  await ensureLogDir();

  const fileName = getLogFileName();
  const filePath = `${LOG_DIR}/${fileName}`;
  const timestamp = getTimestamp();

  const errorStr =
    error instanceof Error
      ? `${error.name}: ${error.message}\nStack: ${error.stack || 'N/A'}`
      : String(error);

  const entry = `\n========== [${timestamp}] ==========\nContext: ${
    context || 'unknown'
  }\n${errorStr}\n`;

  try {
    const exists = await RNFS.exists(filePath);
    if (exists) {
      const stat = await RNFS.stat(filePath);
      if (Number(stat.size) > MAX_LOG_SIZE) {
        await rotateLogsIfNeeded();
      }
      await RNFS.appendFile(filePath, entry, 'utf8');
    } else {
      await RNFS.writeFile(
        filePath,
        `ShellPlayer Crash Log\nDevice Time: ${timestamp}\n${entry}`,
        'utf8',
      );
    }
  } catch (e) {
    console.warn('Failed to write crash log:', e);
  }
}

export async function logInfo(message: string, context?: string) {
  await ensureLogDir();

  const fileName = getLogFileName();
  const filePath = `${LOG_DIR}/${fileName}`;
  const timestamp = getTimestamp();
  const entry = `[${timestamp}] INFO [${context || ''}] ${message}\n`;

  try {
    const exists = await RNFS.exists(filePath);
    if (exists) {
      await RNFS.appendFile(filePath, entry, 'utf8');
    } else {
      await RNFS.writeFile(filePath, `ShellPlayer Log\n${entry}`, 'utf8');
    }
  } catch {}
}

/**
 * 安装全局错误处理器
 */
export function installGlobalErrorHandler() {
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler(async (error, isFatal) => {
    try {
      await logCrash(error, isFatal ? 'FATAL_JS_ERROR' : 'JS_ERROR');
    } catch {}

    // 调用原有处理器
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  // 捕获 Promise rejection
  const tracking = (global as any).__promiseRejectionTrackingOptions;
  if (!tracking) {
    (global as any).onunhandledrejection = async (e: any) => {
      try {
        const err = e?.reason || e;
        await logCrash(
          err instanceof Error ? err : new Error(String(err)),
          'UNHANDLED_PROMISE_REJECTION',
        );
      } catch {}
    };
  }
}
