import { pinyin } from 'pinyin-pro';

const cache = new Map<string, string>();

/**
 * 获取字符串的拼音首字母（大写），用于字母索引分组。
 * 英文直接取首字母；中文取拼音首字母；其他字符返回 '#'。
 */
export function getInitialLetter(str: string): string {
  if (!str) {
    return '#';
  }
  const cached = cache.get(str);
  if (cached) {
    return cached;
  }

  const first = str.charAt(0);
  let letter: string;

  if (/[a-zA-Z]/.test(first)) {
    letter = first.toUpperCase();
  } else if (/[\u4e00-\u9fff]/.test(first)) {
    const py = pinyin(first, { pattern: 'first', toneType: 'none' });
    letter = py ? py.charAt(0).toUpperCase() : '#';
  } else {
    letter = '#';
  }

  cache.set(str, letter);
  return letter;
}

/**
 * 获取完整拼音用于排序（中文转拼音，英文保持原样，全部小写）。
 */
export function getSortKey(str: string): string {
  if (!str) {
    return '';
  }
  const key = `__sort__${str}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  let result = '';
  for (const ch of str) {
    if (/[\u4e00-\u9fff]/.test(ch)) {
      result += pinyin(ch, { toneType: 'none' });
    } else {
      result += ch.toLowerCase();
    }
  }

  cache.set(key, result);
  return result;
}
