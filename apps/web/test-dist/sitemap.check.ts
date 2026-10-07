import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import {
  distFiles,
  frontmatterValue,
  isCleanUrl,
  isNoindex,
  pageUrl,
  publicSlugs,
  readDist,
  SITE,
  slugsWithFlag,
} from './dist-files';

// Escape XML và quy tắc x-default được unit test ở src/lib/seo.test.ts.
const xml = readDist('sitemap.xml');
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  isArray: (name) => name === 'url' || name === 'xhtml:link',
});
const urlset = parser.parse(xml).urlset;

interface Link {
  '@_rel': string;
  '@_hreflang': string;
  '@_href': string;
}
interface Url {
  loc: string;
  lastmod?: string;
  'xhtml:link'?: Link[];
}
const urls: Url[] = urlset?.url ?? [];
const locs = urls.map((u) => u.loc);
const byLoc = new Map(urls.map((u) => [u.loc, u]));
const alternatesOf = (u: Url): Record<string, string> =>
  Object.fromEntries((u['xhtml:link'] ?? []).map((l) => [l['@_hreflang'], l['@_href']]));

/** Trang tĩnh công khai, viết lại độc lập với `STATIC_PATHS` của site (ADR 0015). */
const STATIC = ['/', '/portfolio', '/writeups', '/search', '/cheatsheets'];
const staticUrls = STATIC.flatMap((p) => [
  p === '/' ? `${SITE}/` : `${SITE}${p}`,
  p === '/' ? `${SITE}/en` : `${SITE}/en${p}`,
]);
const writeupUrl = (locale: 'vi' | 'en', slug: string): string =>
  locale === 'vi' ? `${SITE}/writeups/${slug}` : `${SITE}/en/writeups/${slug}`;

describe('sitemap.xml', () => {
  it('là XML hợp lệ, gốc <urlset> đúng namespace', () => {
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(urlset['@_xmlns']).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
    expect(urlset['@_xmlns:xhtml']).toBe('http://www.w3.org/1999/xhtml');
    expect(urls.length).toBeGreaterThan(STATIC.length * 2);
  });

  it('mọi URL (loc và hreflang) tuyệt đối https://mintshell.dev, sạch, không trùng', () => {
    for (const u of urls) {
      expect(isCleanUrl(u.loc), u.loc).toBe(true);
      for (const href of Object.values(alternatesOf(u))) expect(isCleanUrl(href), href).toBe(true);
    }
    expect(new Set(locs).size).toBe(locs.length);
  });

  it('đúng tập trang công khai, tính độc lập từ frontmatter nguồn', () => {
    const expected = [
      ...staticUrls,
      ...publicSlugs('vi').map((s) => writeupUrl('vi', s)),
      ...publicSlugs('en').map((s) => writeupUrl('en', s)),
    ];
    expect([...locs].sort()).toEqual(expected.sort());
  });

  // Lưới an toàn chính: thêm trang mà quên khai báo (hoặc sitemap lọt trang không nên index) → đỏ.
  it('khớp chính xác tập trang .html index được trong dist', () => {
    const indexable = distFiles('.html')
      .filter((f) => !isNoindex(f.content))
      .map((f) => pageUrl(f.path));
    expect([...locs].sort()).toEqual(indexable.sort());
  });

  it('không có draft, fixture, bản pending, 404, /og/*, rss', () => {
    for (const locale of ['vi', 'en'] as const) {
      const hidden = [
        ...slugsWithFlag(locale, 'draft: true'),
        ...slugsWithFlag(locale, 'fixture: true'),
        ...slugsWithFlag(locale, 'translation: pending'),
      ];
      expect(hidden.length).toBeGreaterThan(0);
      for (const slug of hidden) expect(locs).not.toContain(writeupUrl(locale, slug));
    }
    for (const loc of locs) expect(loc).not.toMatch(/404|\/og\/|rss|sample-/);
  });

  it('hreflang chỉ cho bản có thật, hai chiều, x-default ưu tiên vi', () => {
    for (const u of urls) {
      const alternates = alternatesOf(u);
      const langs = Object.keys(alternates);
      if (langs.length === 0) continue;
      expect(langs.sort()).toEqual(['en', 'vi', 'x-default']);
      expect(Object.values(alternates)).toContain(u.loc);
      expect(alternates['x-default']).toBe(alternates.vi);
      for (const target of Object.values(alternates)) {
        const other = byLoc.get(target);
        expect(other, `hreflang trỏ ra ngoài sitemap: ${target}`).toBeDefined();
        expect(alternatesOf(other as Url)).toEqual(alternates);
      }
    }
  });

  it('write-up chỉ có một bản thì không có hreflang', () => {
    const vi = publicSlugs('vi');
    const enOnly = publicSlugs('en').filter((s) => !vi.includes(s));
    expect(enOnly.length).toBeGreaterThan(0);
    for (const slug of enOnly) {
      expect(byLoc.get(writeupUrl('en', slug))?.['xhtml:link']).toBeUndefined();
    }
    for (const slug of publicSlugs('en').filter((s) => vi.includes(s))) {
      expect(Object.keys(alternatesOf(byLoc.get(writeupUrl('en', slug)) as Url))).toHaveLength(3);
    }
  });

  it('lastmod: write-up = updated ?? date (YYYY-MM-DD), trang tĩnh không có', () => {
    for (const loc of staticUrls) expect(byLoc.get(loc)?.lastmod).toBeUndefined();
    for (const locale of ['vi', 'en'] as const) {
      for (const slug of publicSlugs(locale)) {
        const raw =
          frontmatterValue(slug, locale, 'updated') ?? frontmatterValue(slug, locale, 'date');
        const expected = new Date(raw ?? '').toISOString().slice(0, 10);
        expect(byLoc.get(writeupUrl(locale, slug))?.lastmod).toBe(expected);
      }
    }
  });
});
