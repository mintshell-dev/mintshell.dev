import { readdirSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIST = new URL('../dist/', import.meta.url);

export const SITE = 'https://mintshell.dev';

export interface DistFile {
  /** Đường dẫn tương đối trong dist, dùng `/` (vd. `en/writeups.html`). */
  path: string;
  content: string;
}

/** Mọi file trong dist có đuôi `ext`, sắp theo đường dẫn. */
export function distFiles(ext: string): DistFile[] {
  const root = fileURLToPath(DIST);
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => {
      const full = `${entry.parentPath}/${entry.name}`;
      return { path: relative(root, full), content: readFileSync(full, 'utf8') };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function readDist(path: string): string {
  return readFileSync(new URL(path, DIST), 'utf8');
}

/** Thẻ mở khớp `tag`, kèm chuỗi thuộc tính. */
export function tags(html: string, tag: string): string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
}

/** Giá trị thuộc tính `name` trong một thẻ mở. */
export function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag)?.[1];
}

/** Nội dung chữ của phần tử đầu tiên khớp `tag` (bỏ thẻ con). */
export function textOf(html: string, tag: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(html);
  if (!match?.[1]) throw new Error(`Không tìm thấy <${tag}>`);
  return match[1].replace(/<[^>]+>/g, '');
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Chunk metadata không được có trong PNG xuất ra (C2PA, văn bản, EXIF, thời điểm tạo). */
export const PNG_METADATA_CHUNKS = ['caBX', 'tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'];

/** Danh sách loại chunk của một file PNG. */
export function pngChunks(buf: Buffer): string[] {
  const types: string[] = [];
  for (let i = PNG_SIGNATURE.length; i + 8 <= buf.length;) {
    const length = buf.readUInt32BE(i);
    types.push(buf.toString('latin1', i + 4, i + 8));
    i += 12 + length;
  }
  return types;
}

/** Kích thước PNG đọc từ IHDR (chunk đầu tiên, ngay sau chữ ký). */
export function pngSize(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export const isNotFound = (path: string): boolean => /(^|\/)404\.html$/.test(path);

const CONTENT = new URL('../../../content/writeups/', import.meta.url);

/**
 * Thư mục write-up thật: bỏ thư mục bắt đầu bằng `_` (vd. `_import/` của `pnpm notion:pull`, ADR 0013)
 * và `.` (thư mục tạm/ẩn), nhất quán với collection Astro (glob không tự bỏ qua thư mục `_`,
 * `content.config.ts` loại trừ tường minh).
 */
export const isWriteupDir = (name: string): boolean =>
  !name.startsWith('_') && !name.startsWith('.');

/**
 * Slug write-up công khai của một ngôn ngữ, tính độc lập từ frontmatter nguồn (không dùng lại
 * code của site): bỏ `draft: true`, `fixture: true` và `translation: pending` (cả vi lẫn en: mỗi trang chỉ liệt kê bài có
 * bản ngôn ngữ đó thật).
 * `dir` chỉ để test; mặc định là `content/writeups/`.
 */
export function publicSlugs(locale: 'vi' | 'en', dir: URL = CONTENT): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isWriteupDir(d.name))
    .filter((d) => {
      const source = readFileSync(new URL(`${d.name}/${locale}.mdx`, dir), 'utf8');
      const front = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
      const flag = (line: string) => new RegExp(`^${line}\\s*$`, 'm').test(front);
      if (flag('draft: true') || flag('fixture: true')) return false;
      return !flag('translation: pending');
    })
    .map((d) => d.name)
    .sort();
}

/** Slug mà frontmatter của `<slug>/<locale>.mdx` có đúng dòng `line` (vd. `translation: pending`). */
export function slugsWithFlag(locale: 'vi' | 'en', line: string, dir: URL = CONTENT): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isWriteupDir(d.name))
    .filter((d) => {
      const source = readFileSync(new URL(`${d.name}/${locale}.mdx`, dir), 'utf8');
      const front = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
      return front.split('\n').some((l) => l.trim() === line);
    })
    .map((d) => d.name)
    .sort();
}
