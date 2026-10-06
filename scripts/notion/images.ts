import { ipLabel } from './scan.ts';
import type { FetchFn } from './types.ts';

/**
 * Tải ảnh của bài về `_import/<slug>/images/`. Chỉ https, tối đa 10 MiB, kiểu xác định bằng
 * magic bytes (PNG/JPEG/GIF/WebP); SVG bị từ chối vì có thể chứa script. Không gửi token Notion
 * tới host ảnh. Metadata (EXIF/XMP/tEXt…) chỉ được phát hiện và báo, không bị xóa.
 */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 30_000;

export type ImageKind = 'png' | 'jpeg' | 'gif' | 'webp';

const EXT: Record<ImageKind, string> = { png: 'png', jpeg: 'jpg', gif: 'gif', webp: 'webp' };

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

export function sniff(bytes: Uint8Array): ImageKind | 'svg' | null {
  if (bytes.length >= 8 && ascii(bytes, 1, 4) === 'PNG' && bytes[0] === 0x89) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpeg';
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return 'gif';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP')
    return 'webp';
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  return null;
}

const be32 = (b: Uint8Array, i: number) =>
  (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
const le32 = (b: Uint8Array, i: number) =>
  ((b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16) | ((b[i + 3] ?? 0) << 24)) >>> 0;

/** Tên khối metadata có thể chứa thông tin định danh (tên máy, người dùng, phần mềm, GPS…). */
export function findMetadata(bytes: Uint8Array, kind: ImageKind): string[] {
  const found = new Set<string>();
  if (kind === 'png') {
    const META = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf']);
    for (let i = 8; i + 8 <= bytes.length;) {
      const len = be32(bytes, i);
      const type = ascii(bytes, i + 4, i + 8);
      if (META.has(type)) found.add(type);
      if (type === 'IEND') break;
      i += 12 + len;
    }
  } else if (kind === 'jpeg') {
    for (let i = 2; i + 4 <= bytes.length;) {
      if (bytes[i] !== 0xff) break;
      if (bytes[i + 1] === 0xff) {
        i++; // byte đệm 0xFF trước marker
        continue;
      }
      const marker = bytes[i + 1] ?? 0;
      if (marker === 0xda || marker === 0xd9) break; // SOS/EOI: hết phần header
      const len = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
      const body = ascii(bytes, i + 4, Math.min(i + 4 + 29, bytes.length));
      if (marker === 0xe1 && body.startsWith('Exif')) found.add('Exif');
      else if (marker === 0xe1 && body.startsWith('http://ns.adobe.com/xap/1.0/')) found.add('XMP');
      else if (marker === 0xed) found.add('IPTC');
      else if (marker === 0xfe) found.add('COM');
      i += 2 + len;
    }
  } else if (kind === 'gif') {
    // Ước lượng (báo thừa): Comment Extension 0x21 0xFE, XMP trong Application Extension.
    for (let i = 13; i + 1 < bytes.length; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xfe) found.add('Comment');
    }
    if (ascii(bytes, 0, bytes.length).includes('XMP DataXMP')) found.add('XMP');
  } else if (kind === 'webp') {
    for (let i = 12; i + 8 <= bytes.length;) {
      const type = ascii(bytes, i, i + 4);
      if (type === 'EXIF' || type === 'XMP ') found.add(type.trim());
      i += 8 + le32(bytes, i + 4) + (le32(bytes, i + 4) % 2);
    }
  }
  return [...found];
}

/** `01-<tên gốc ASCII, ≤ 40 ký tự>.<ext>`; tên gốc lấy từ đường dẫn URL. */
export function imageFileName(index: number, url: string, kind: ImageKind): string {
  let base: string;
  try {
    const last = new URL(url).pathname.split('/').pop() ?? '';
    base = decodeURIComponent(last).replace(/\.[^.]*$/, '');
  } catch {
    base = '';
  }
  const slug = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `${String(index).padStart(2, '0')}-${slug || 'image'}.${EXT[kind]}`;
}

/**
 * Host không được tải ảnh: localhost, IP literal không công khai, mọi IPv6 literal (giảm SSRF vào mạng
 * nội bộ qua link ảnh hay chuyển hướng). Tên miền trỏ tới IP riêng thì tường lửa Dev Container chặn.
 */
export function blockedHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return 'localhost';
  if (host.startsWith('[')) return 'IPv6 literal';
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const label = ipLabel(m.slice(1, 5).map(Number));
    if (label !== 'công khai') return `IP ${label}`;
  }
  return null;
}

export type DownloadResult =
  | { ok: true; bytes: Uint8Array; kind: ImageKind; metadata: string[] }
  | { ok: false; reason: string };

export async function downloadImage(url: string, doFetch: FetchFn): Promise<DownloadResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'URL không hợp lệ' };
  }
  // Theo chuyển hướng thủ công để kiểm từng bước TRƯỚC khi gửi request: chỉ https, không host nội bộ.
  let res: Response;
  for (let hop = 0; ; hop++) {
    if (parsed.protocol !== 'https:') {
      const reason = hop ? 'bị chuyển hướng sang URL không phải https' : 'chỉ tải ảnh qua https';
      return { ok: false, reason };
    }
    const blocked = blockedHost(parsed.hostname);
    if (blocked) return { ok: false, reason: `host bị chặn (${blocked})` };
    try {
      res = await doFetch(parsed.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : 'lỗi';
      return { ok: false, reason: `không kết nối được ${parsed.hostname} (${name}); tường lửa?` };
    }
    if (res.status < 300 || res.status >= 400) break;
    const location = res.headers.get('location');
    await res.body?.cancel();
    if (!location || hop >= MAX_REDIRECTS) {
      return { ok: false, reason: `chuyển hướng không hợp lệ hoặc quá ${MAX_REDIRECTS} lần` };
    }
    try {
      parsed = new URL(location, parsed);
    } catch {
      return { ok: false, reason: 'chuyển hướng tới URL không hợp lệ' };
    }
  }
  if (!res.ok) {
    await res.body?.cancel();
    return { ok: false, reason: `HTTP ${res.status} từ ${parsed.hostname}` };
  }
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    await res.body?.cancel();
    return { ok: false, reason: `ảnh quá ${MAX_IMAGE_BYTES / 1024 / 1024} MiB` };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, reason: 'phản hồi rỗng' };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return { ok: false, reason: `ảnh quá ${MAX_IMAGE_BYTES / 1024 / 1024} MiB` };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }

  const kind = sniff(bytes);
  if (kind === 'svg') return { ok: false, reason: 'SVG bị từ chối (có thể chứa script)' };
  if (!kind) return { ok: false, reason: 'không phải PNG/JPEG/GIF/WebP' };
  return { ok: true, bytes, kind, metadata: findMetadata(bytes, kind) };
}
