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

export const isNotFound = (path: string): boolean => /(^|\/)404\.html$/.test(path);

const CONTENT = new URL('../../../content/writeups/', import.meta.url);

/**
 * Slug write-up công khai của một ngôn ngữ, tính độc lập từ frontmatter nguồn (không dùng lại
 * code của site): bỏ `draft: true`, `fixture: true`, và với en bỏ `translation: pending`.
 */
export function publicSlugs(locale: 'vi' | 'en'): string[] {
  return readdirSync(CONTENT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => {
      const source = readFileSync(new URL(`${d.name}/${locale}.mdx`, CONTENT), 'utf8');
      const front = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
      const flag = (line: string) => new RegExp(`^${line}\\s*$`, 'm').test(front);
      if (flag('draft: true') || flag('fixture: true')) return false;
      return !(locale === 'en' && flag('translation: pending'));
    })
    .map((d) => d.name)
    .sort();
}
