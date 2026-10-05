import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  attr,
  DIST,
  distFiles,
  PNG_METADATA_CHUNKS,
  PNG_SIGNATURE,
  pngChunks,
  tags,
} from './dist-files';

const html = distFiles('.html');

/** Ba thẻ icon bắt buộc ở mọi trang, theo (rel, href) kèm thuộc tính phụ. */
const icons = [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
] as const;

describe('icon trên mọi trang (kể cả 404)', () => {
  it.each(html)('$path', ({ content }) => {
    const links = tags(content, 'link');
    for (const icon of icons) {
      const found = links.filter(
        (l) => attr(l, 'rel') === icon.rel && attr(l, 'href') === icon.href,
      );
      expect(found, `thiếu ${icon.rel} ${icon.href}`).toHaveLength(1);
      for (const [name, value] of Object.entries(icon)) {
        expect(attr(found[0] ?? '', name), `${icon.href}: ${name}`).toBe(value);
      }
    }
    const themeColor = tags(content, 'meta').filter((m) => attr(m, 'name') === 'theme-color');
    expect(themeColor).toHaveLength(1);
    expect(attr(themeColor[0] ?? '', 'content')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('file icon trong dist', () => {
  it.each(icons.map((i) => i.href))('%s tồn tại', (href) => {
    expect(existsSync(new URL(`.${href}`, DIST))).toBe(true);
  });

  it.each(['/favicon-32.png', '/apple-touch-icon.png'])('%s là PNG, không có metadata', (href) => {
    const png = readFileSync(new URL(`.${href}`, DIST));
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    const types = pngChunks(png);
    expect(types[0]).toBe('IHDR');
    expect(types.at(-1)).toBe('IEND');
    for (const chunk of PNG_METADATA_CHUNKS)
      expect(types, `có chunk ${chunk}`).not.toContain(chunk);
  });
});

describe('favicon.svg an toàn', () => {
  const svg = readFileSync(new URL('favicon.svg', DIST), 'utf8');

  it('là SVG', () => {
    expect(svg.trimStart()).toMatch(/^<svg\b/);
  });

  it('không có script, foreignObject hay thuộc tính on*=', () => {
    expect(svg).not.toMatch(/<script\b/i);
    expect(svg).not.toMatch(/<foreignObject\b/i);
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('không có metadata (C2PA hay khác)', () => {
    expect(svg).not.toMatch(/<metadata\b/i);
    expect(svg).not.toMatch(/c2pa/i);
  });

  it('không tham chiếu ra ngoài', () => {
    // xmlns chỉ là định danh namespace, trình duyệt không tải.
    const withoutNamespaces = svg.replace(/\sxmlns(:[\w-]+)?="[^"]*"/g, '');
    expect(withoutNamespaces).not.toMatch(/\s(?:xlink:)?href\s*=/i);
    expect(withoutNamespaces).not.toMatch(/\ssrc\s*=/i);
    expect(withoutNamespaces).not.toMatch(/url\(/i);
    expect(withoutNamespaces).not.toMatch(/@import/i);
    expect(withoutNamespaces).not.toMatch(/(?:[a-z][a-z0-9+.-]*:)?\/\//i);
  });
});
