// src/utils/id3Parser.ts
import RNFS from 'react-native-fs';
import iconv from 'iconv-lite';

// 确保 iconv-lite 加载 GBK 编码支持
if (iconv.encodingExists && !iconv.encodingExists('gbk')) {
  console.warn('iconv-lite: GBK encoding not available');
}

interface ID3Result {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string;
  lyrics?: string;
}

export async function parseID3(filePath: string): Promise<ID3Result> {
  const result: ID3Result = {};
  try {
    const headerB64 = await RNFS.read(filePath, 10, 0, 'base64');
    const hb = b64ToBytes(headerB64);
    if (hb[0] !== 0x49 || hb[1] !== 0x44 || hb[2] !== 0x33) return result;

    const ver = hb[3];
    const tagSize =
      ((hb[6] & 0x7f) << 21) | ((hb[7] & 0x7f) << 14) |
      ((hb[8] & 0x7f) << 7) | (hb[9] & 0x7f);

    const readSize = Math.min(tagSize, 2 * 1024 * 1024);
    const tagB64 = await RNFS.read(filePath, readSize + 10, 0, 'base64');
    const tb = b64ToBytes(tagB64);
    let off = 10;

    while (off < tagSize + 10 - 10) {
      if (ver >= 3) {
        if (off + 10 > tb.length) break;
        const fid = String.fromCharCode(tb[off], tb[off + 1], tb[off + 2], tb[off + 3]);
        if (fid === '\0\0\0\0' || fid.charCodeAt(0) === 0) break;

        let fsz: number;
        if (ver === 4) {
          fsz = ((tb[off + 4] & 0x7f) << 21) | ((tb[off + 5] & 0x7f) << 14) |
            ((tb[off + 6] & 0x7f) << 7) | (tb[off + 7] & 0x7f);
        } else {
          fsz = (tb[off + 4] << 24) | (tb[off + 5] << 16) |
            (tb[off + 6] << 8) | tb[off + 7];
        }
        if (fsz <= 0 || fsz > tagSize) break;

        const ds = off + 10;
        const de = ds + fsz;
        if (de > tb.length) break;
        const fd = tb.slice(ds, de);

        if (fid === 'TIT2') result.title = decTextFrame(fd);
        else if (fid === 'TPE1') result.artist = decTextFrame(fd);
        else if (fid === 'TALB') result.album = decTextFrame(fd);
        else if (fid === 'APIC') result.artwork = decAPIC(fd);
        else if (fid === 'USLT') result.lyrics = decUSLT(fd);

        off = de;
      } else {
        // ID3v2.2
        if (off + 6 > tb.length) break;
        const fid = String.fromCharCode(tb[off], tb[off + 1], tb[off + 2]);
        if (fid === '\0\0\0' || fid.charCodeAt(0) === 0) break;

        const fsz = (tb[off + 3] << 16) | (tb[off + 4] << 8) | tb[off + 5];
        if (fsz <= 0 || fsz > tagSize) break;

        const ds = off + 6;
        const de = ds + fsz;
        if (de > tb.length) break;
        const fd = tb.slice(ds, de);

        if (fid === 'TT2') result.title = decTextFrame(fd);
        else if (fid === 'TP1') result.artist = decTextFrame(fd);
        else if (fid === 'TAL') result.album = decTextFrame(fd);
        else if (fid === 'PIC') result.artwork = decPIC(fd);
        else if (fid === 'ULT') result.lyrics = decUSLT(fd);

        off = de;
      }
    }
  } catch (e) {
    console.warn('ID3 parse error:', e);
  }
  return result;
}

// ---- 帧解码 ----

function decTextFrame(d: Uint8Array): string {
  if (d.length < 2) return '';
  return decStr(d.slice(1), d[0]);
}

function decUSLT(d: Uint8Array): string {
  if (d.length < 5) return '';
  const enc = d[0];
  let o = 4; // skip encoding + 3 bytes language
  o = skipNullTerm(d, o, enc);
  if (o >= d.length) return '';
  return decStr(d.slice(o), enc);
}

function decAPIC(d: Uint8Array): string | undefined {
  if (d.length < 4) return undefined;
  const enc = d[0];
  let o = 1;
  // MIME type (ASCII null-terminated)
  let mime = '';
  while (o < d.length && d[o] !== 0) { mime += String.fromCharCode(d[o]); o++; }
  o++; // null
  if (!mime) mime = 'image/jpeg';
  o++; // picture type
  o = skipNullTerm(d, o, enc);
  if (o >= d.length) return undefined;
  const img = d.slice(o);
  if (img.length < 10) return undefined;
  return `data:${mime};base64,${bytesToB64(img)}`;
}

function decPIC(d: Uint8Array): string | undefined {
  if (d.length < 6) return undefined;
  const enc = d[0];
  const fmt = String.fromCharCode(d[1], d[2], d[3]);
  const mime = fmt.toUpperCase() === 'PNG' ? 'image/png' : 'image/jpeg';
  let o = 5;
  o = skipNullTerm(d, o, enc);
  if (o >= d.length) return undefined;
  const img = d.slice(o);
  if (img.length < 10) return undefined;
  return `data:${mime};base64,${bytesToB64(img)}`;
}

/** 跳过 null 终止符 */
function skipNullTerm(d: Uint8Array, offset: number, enc: number): number {
  if (enc === 0 || enc === 3) {
    // 单字节 null
    while (offset < d.length && d[offset] !== 0) offset++;
    return offset + 1;
  } else {
    // UTF-16 双字节 null
    while (offset + 1 < d.length) {
      if (d[offset] === 0 && d[offset + 1] === 0) break;
      offset += 2;
    }
    return offset + 2;
  }
}

// ---- 核心：字符串解码（修复中文乱码）----

/**
 * 根据 ID3 encoding 标志解码字符串
 *
 * encoding 0 = 标称 ISO-8859-1，但中文 MP3 实际常用 GBK 或 UTF-8
 * encoding 1 = UTF-16 with BOM
 * encoding 2 = UTF-16BE
 * encoding 3 = UTF-8
 */
function decStr(raw: Uint8Array, enc: number): string {
  // 去掉尾部 null
  let len = raw.length;
  while (len > 0 && raw[len - 1] === 0) len--;
  const d = raw.slice(0, len);
  if (d.length === 0) return '';

  switch (enc) {
    case 1: return decUTF16(d);
    case 2: return decUTF16BE(d);
    case 3: return decUTF8(d);
    case 0: default:
      return decAutoDetect(d);
  }
}

/**
 * 自动检测编码：UTF-8 → GBK → Latin1
 * 这是解决中文乱码的关键函数
 */
function decAutoDetect(d: Uint8Array): string {
  // 纯 ASCII，直接返回
  if (!hasHighBytes(d)) return decLatin1(d);

  // 1. 尝试 UTF-8 解码
  const utf8 = tryUTF8(d);
  if (utf8 !== null) return utf8;

  // 2. 用 iconv-lite 解码 GBK（中文 MP3 最常见的编码）
  try {
    const buf = Buffer.from(d);
    const decoded = iconv.decode(buf, 'gbk');
    // 验证解码结果：如果包含大量替换字符则认为失败
    if (decoded && !decoded.includes('\ufffd')) {
      return decoded;
    }
  } catch {}

  // 3. 尝试 GB18030（GBK 的超集）
  try {
    const buf = Buffer.from(d);
    const decoded = iconv.decode(buf, 'gb18030');
    if (decoded && !decoded.includes('\ufffd')) {
      return decoded;
    }
  } catch {}

  // 4. 最终回退 Latin1
  return decLatin1(d);
}

function hasHighBytes(d: Uint8Array): boolean {
  for (let i = 0; i < d.length; i++) {
    if (d[i] > 0x7f) return true;
  }
  return false;
}

/**
 * 手动验证并解码 UTF-8
 * 返回 null 表示不是合法 UTF-8
 */
function tryUTF8(d: Uint8Array): string | null {
  let i = 0;
  const codes: number[] = [];
  while (i < d.length) {
    const b = d[i];
    if (b < 0x80) {
      codes.push(b); i++;
    } else if (b >= 0xc2 && b < 0xe0) {
      if (i + 1 >= d.length || (d[i + 1] & 0xc0) !== 0x80) return null;
      codes.push(((b & 0x1f) << 6) | (d[i + 1] & 0x3f));
      i += 2;
    } else if (b >= 0xe0 && b < 0xf0) {
      if (i + 2 >= d.length || (d[i + 1] & 0xc0) !== 0x80 || (d[i + 2] & 0xc0) !== 0x80) return null;
      codes.push(((b & 0x0f) << 12) | ((d[i + 1] & 0x3f) << 6) | (d[i + 2] & 0x3f));
      i += 3;
    } else if (b >= 0xf0 && b < 0xf5) {
      if (i + 3 >= d.length) return null;
      // 4字节 UTF-8 → surrogate pair
      const cp = ((b & 0x07) << 18) | ((d[i + 1] & 0x3f) << 12) |
        ((d[i + 2] & 0x3f) << 6) | (d[i + 3] & 0x3f);
      codes.push(0xd800 + ((cp - 0x10000) >> 10));
      codes.push(0xdc00 + ((cp - 0x10000) & 0x3ff));
      i += 4;
    } else {
      return null; // 非法 UTF-8 字节
    }
  }
  return String.fromCharCode(...codes);
}

function decLatin1(d: Uint8Array): string {
  let s = '';
  for (let i = 0; i < d.length; i++) {
    if (d[i] === 0) break;
    s += String.fromCharCode(d[i]);
  }
  return s;
}

function decUTF16(d: Uint8Array): string {
  if (d.length < 2) return '';
  const bom = (d[0] << 8) | d[1];
  const le = bom === 0xfffe;
  const start = (bom === 0xfeff || bom === 0xfffe) ? 2 : 0;
  let s = '';
  for (let i = start; i + 1 < d.length; i += 2) {
    const c = le ? (d[i + 1] << 8) | d[i] : (d[i] << 8) | d[i + 1];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function decUTF16BE(d: Uint8Array): string {
  let s = '';
  for (let i = 0; i + 1 < d.length; i += 2) {
    const c = (d[i] << 8) | d[i + 1];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function decUTF8(d: Uint8Array): string {
  const result = tryUTF8(d);
  if (result !== null) return result;
  return decLatin1(d); // fallback
}

// ---- Base64 工具 ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64ToBytes(s: string): Uint8Array {
  const c = s.replace(/[\s=]/g, '');
  const l = c.length;
  const r = new Uint8Array(Math.floor((l * 3) / 4));
  let x = 0;
  for (let i = 0; i < l; i += 4) {
    const a = B64.indexOf(c[i]);
    const b = i + 1 < l ? B64.indexOf(c[i + 1]) : 0;
    const d = i + 2 < l ? B64.indexOf(c[i + 2]) : 0;
    const e = i + 3 < l ? B64.indexOf(c[i + 3]) : 0;
    r[x++] = (a << 2) | (b >> 4);
    if (i + 2 < l) r[x++] = ((b & 0x0f) << 4) | (d >> 2);
    if (i + 3 < l) r[x++] = ((d & 0x03) << 6) | e;
  }
  return r.slice(0, x);
}

function bytesToB64(d: Uint8Array): string {
  let r = '';
  const l = d.length;
  for (let i = 0; i < l; i += 3) {
    const a = d[i], b = i + 1 < l ? d[i + 1] : 0, c = i + 2 < l ? d[i + 2] : 0;
    r += B64[a >> 2];
    r += B64[((a & 3) << 4) | (b >> 4)];
    r += i + 1 < l ? B64[((b & 0x0f) << 2) | (c >> 6)] : '=';
    r += i + 2 < l ? B64[c & 0x3f] : '=';
  }
  return r;
}