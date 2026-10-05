import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  attr,
  DIST,
  distFiles,
  PNG_METADATA_CHUNKS,
  PNG_SIGNATURE,
  pngChunks,
  pngSize,
  publicSlugs,
  readDist,
  SITE,
  tags,
} from './dist-files';

// Ảnh Open Graph (ADR 0012): mọi trang có đúng một og:image cùng origin, file PNG 1200×630
// tồn tại trong dist; write-up công khai có cover riêng theo ngôn ngữ.
const html = distFiles('.html');
const DEFAULT = `${SITE}/og/default.png`;

const metas = (content: string, key: 'property' | 'name', value: string): string[] =>
  tags(content, 'meta')
    .filter((m) => attr(m, key) === value)
    .map((m) => attr(m, 'content') ?? '');

const coverUrl = (locale: 'vi' | 'en', slug: string): string =>
  locale === 'vi' ? `${SITE}/og/writeups/${slug}.png` : `${SITE}/og/en/writeups/${slug}.png`;

/** Kiểm tra một URL ảnh OG: cùng origin, file có trong dist, PNG 1200×630 không metadata. */
function expectValidImage(url: string): void {
  const parsed = new URL(url);
  expect(parsed.origin, url).toBe(SITE);
  expect(parsed.pathname, url).toMatch(/^\/og\/[a-z0-9/-]+\.png$/);
  const file = new URL(`.${parsed.pathname}`, DIST);
  expect(existsSync(file), `thiếu file ${parsed.pathname}`).toBe(true);
  const png = readFileSync(file);
  expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
  const chunks = pngChunks(png);
  expect(chunks[0]).toBe('IHDR');
  for (const chunk of PNG_METADATA_CHUNKS) expect(chunks, `có chunk ${chunk}`).not.toContain(chunk);
}

describe('og:image trên mọi trang (kể cả 404)', () => {
  it.each(html)('$path', ({ content }) => {
    const og = metas(content, 'property', 'og:image');
    expect(og, 'cần đúng một og:image').toHaveLength(1);
    const url = og[0] ?? '';
    expectValidImage(url);

    expect(metas(content, 'name', 'twitter:image')).toEqual([url]);
    expect(metas(content, 'name', 'twitter:card')).toEqual(['summary_large_image']);
    expect(metas(content, 'property', 'og:image:width')).toEqual(['1200']);
    expect(metas(content, 'property', 'og:image:height')).toEqual(['630']);
    expect(metas(content, 'property', 'og:image:type')).toEqual(['image/png']);
    const alt = metas(content, 'property', 'og:image:alt');
    expect(alt).toHaveLength(1);
    expect(alt[0]?.trim()).not.toBe('');
  });
});

describe.each(['vi', 'en'] as const)('cover riêng cho write-up công khai (%s)', (locale) => {
  const slugs = publicSlugs(locale);

  it('có write-up công khai để kiểm tra', () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  it.each(slugs)('%s', (slug) => {
    const page = readDist(`${locale === 'vi' ? '' : 'en/'}writeups/${slug}.html`);
    const og = metas(page, 'property', 'og:image');
    expect(og).toEqual([coverUrl(locale, slug)]);
    expectValidImage(coverUrl(locale, slug));
    // Cover khác ảnh mặc định (không phải bản sao).
    const cover = readFileSync(new URL(`.${new URL(coverUrl(locale, slug)).pathname}`, DIST));
    expect(cover.equals(readFileSync(new URL('og/default.png', DIST)))).toBe(false);
  });
});

describe('trang không có cover riêng dùng ảnh mặc định', () => {
  const others = html.filter((f) => !/^(en\/)?writeups\/[^/]+\.html$/.test(f.path));

  it.each(others)('$path', ({ content }) => {
    expect(metas(content, 'property', 'og:image')).toEqual([DEFAULT]);
  });

  it('bản en chưa dịch (pending) dùng ảnh mặc định, không có cover en', () => {
    const page = readDist('en/writeups/sample-pending.html');
    expect(metas(page, 'property', 'og:image')).toEqual([DEFAULT]);
    expect(existsSync(new URL('og/en/writeups/sample-pending.png', DIST))).toBe(false);
  });
});

describe('thư mục dist/og chỉ chứa ảnh PNG hợp lệ', () => {
  const root = fileURLToPath(new URL('og/', DIST));
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => `${e.parentPath}/${e.name}`.slice(root.length));

  it.each(files)('%s', (file) => {
    expect(file).toMatch(/\.png$/);
    expectValidImage(`${SITE}/og/${file}`);
  });
});
