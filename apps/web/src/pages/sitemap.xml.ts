import { locales } from '@mintshell/shared';
import type { APIRoute } from 'astro';

import { type SitemapGroup, sitemapXml, STATIC_PATHS } from '../lib/seo';
import { listWriteups, slugOf } from '../lib/writeups';

/**
 * Sitemap: trang tĩnh (đủ vi/en) và write-up công khai theo đúng `isListed` như danh sách/RSS, nên không có
 * draft, fixture, bản pending hay 404 (ADR 0015).
 */
export const GET: APIRoute = async ({ site }) => {
  const writeups = new Map<string, Required<SitemapGroup>>();
  for (const locale of locales) {
    for (const entry of await listWriteups(locale)) {
      const path = `/writeups/${slugOf(entry.id)}`;
      const group = writeups.get(path) ?? { path, locales: [], lastmod: {} };
      group.locales = [...group.locales, locale];
      group.lastmod[locale] = entry.data.updated ?? entry.data.date;
      writeups.set(path, group);
    }
  }
  const groups: SitemapGroup[] = [
    ...STATIC_PATHS.map((path) => ({ path, locales })),
    ...[...writeups.values()].sort((a, b) => a.path.localeCompare(b.path)),
  ];
  return new Response(sitemapXml(groups, site ?? new URL('https://mintshell.dev')), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
