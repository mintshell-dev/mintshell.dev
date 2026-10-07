import { type Locale, localizePath, locales } from '@mintshell/shared';

/**
 * Trang tĩnh công khai, path chung (không tiền tố ngôn ngữ); mỗi trang có đủ bản vi và en (ADR 0015).
 * Thêm trang mới thì thêm ở đây: `test:dist` so sitemap với mọi trang index được trong `dist`.
 */
export const STATIC_PATHS = ['/', '/portfolio', '/writeups', '/search', '/cheatsheets'] as const;

/** `x-default` trỏ bản tiếng Việt (ngôn ngữ gốc, ADR 0004) nếu có, không thì bản đầu tiên. */
export function xDefault(alternates: readonly Locale[]): Locale {
  if (alternates.includes('vi')) return 'vi';
  const first = alternates[0];
  if (!first) throw new Error('Trang không có bản ngôn ngữ nào');
  return first;
}

/** Một trang (path chung) và các bản ngôn ngữ có thật của nó. */
export interface SitemapGroup {
  /** Path không tiền tố ngôn ngữ, vd. `/writeups/binex`. */
  path: string;
  /** Bản ngôn ngữ có thật; thứ tự theo `locales`. */
  locales: readonly Locale[];
  /** Ngày sửa cuối của từng bản (write-up: `updated ?? date`); trang tĩnh để trống. */
  lastmod?: Partial<Record<Locale, Date>>;
}

/** Escape cho nội dung text và thuộc tính XML. */
export const escapeXml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * `sitemap.xml` (sitemaps.org 0.9, hreflang qua `xhtml:link`): mỗi bản ngôn ngữ một `<url>`; bản có cặp thì
 * liệt kê mọi bản cùng `x-default`, bản lẻ thì không có hreflang (không trỏ tới trang không tồn tại).
 */
export function sitemapXml(groups: readonly SitemapGroup[], site: URL): string {
  const abs = (path: string, locale: Locale) =>
    escapeXml(new URL(localizePath(path, locale), site).href);
  const urls = groups.flatMap((group) => {
    const own = locales.filter((l) => group.locales.includes(l));
    const links =
      own.length < 2
        ? []
        : [
            ...own.map((l) => [l, abs(group.path, l)] as const),
            ['x-default', abs(group.path, xDefault(own))] as const,
          ].map(
            ([hreflang, href]) =>
              `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`,
          );
    return own.map((locale) => {
      const lastmod = group.lastmod?.[locale];
      return [
        '  <url>',
        `    <loc>${abs(group.path, locale)}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`] : []),
        ...links,
        '  </url>',
      ].join('\n');
    });
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
