import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import { attr, distFiles, publicSlugs, readDist, SITE, tags } from './dist-files';

// Escape XML được unit test ở src/lib/feed.test.ts (dữ liệu độc không nằm trong content).
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

interface Item {
  link: string;
  guid: { '#text': string };
  pubDate: string;
}

const feeds = [
  { locale: 'vi', path: 'rss.xml', base: `${SITE}/writeups/`, home: SITE },
  { locale: 'en', path: 'en/rss.xml', base: `${SITE}/en/writeups/`, home: `${SITE}/en` },
] as const;

describe.each(feeds)('feed $path', ({ locale, path, base, home }) => {
  const xml = readDist(path);
  const channel = parser.parse(xml).rss.channel;
  const items: Item[] = [channel.item ?? []].flat();

  it('là XML hợp lệ', () => {
    expect(XMLValidator.validate(xml)).toBe(true);
  });

  it('kênh đúng ngôn ngữ, link tuyệt đối về trang chủ', () => {
    expect(channel.language).toBe(locale);
    expect(channel.link).toBe(home);
  });

  it('đúng tập write-up công khai (không draft, fixture, pending)', () => {
    const slugs = items.map((i) => i.link.slice(base.length)).sort();
    expect(slugs).toEqual(publicSlugs(locale));
    expect(xml).not.toMatch(/sample-/);
  });

  it('link/guid tuyệt đối https://mintshell.dev, đúng ngôn ngữ', () => {
    for (const item of items) {
      expect(item.link.startsWith(base), item.link).toBe(true);
      expect(item.guid['#text']).toBe(item.link);
    }
  });

  it('mới nhất trước', () => {
    const times = items.map((i) => Date.parse(i.pubDate));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe('mọi trang khai báo feed đúng ngôn ngữ', () => {
  it.each(distFiles('.html'))('$path', ({ path, content }) => {
    const links = tags(content, 'link').filter(
      (l) => attr(l, 'rel') === 'alternate' && attr(l, 'type') === 'application/rss+xml',
    );
    expect(links).toHaveLength(1);
    const en = path === 'en.html' || path.startsWith('en/');
    expect(attr(links[0] ?? '', 'href')).toBe(en ? `${SITE}/en/rss.xml` : `${SITE}/rss.xml`);
  });
});
