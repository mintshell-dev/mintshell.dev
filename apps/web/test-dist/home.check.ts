import { describe, expect, it } from 'vitest';

import { attr, publicSlugs, readDist, tags } from './dist-files';

describe.each([
  { path: 'index.html', prefix: '' },
  { path: 'en.html', prefix: '/en' },
])('trang chủ $path', ({ path, prefix }) => {
  const page = readDist(path);
  const hrefs = tags(page, 'a').map((a) => attr(a, 'href'));
  const writeupLinks = [...new Set(hrefs.filter((h) => h?.startsWith(`${prefix}/writeups/`)))];

  it('dẫn tới write-ups, portfolio, RSS và tìm kiếm đúng ngôn ngữ', () => {
    for (const target of ['/writeups', '/portfolio', '/rss.xml', '/search']) {
      expect(hrefs, target).toContain(`${prefix}${target}`);
    }
  });

  it('không còn trang "Hello" tạm', () => {
    expect(page).not.toMatch(/<h1[^>]*>\s*(?:Xin chào|Hello)\s*<\/h1>/);
  });

  it('liệt kê 1–5 write-up mới nhất, không fixture/draft', () => {
    const locale = prefix ? 'en' : 'vi';
    expect(writeupLinks.length).toBe(Math.min(5, publicSlugs(locale).length));
    expect(writeupLinks.length).toBeGreaterThan(0);
    expect(page).not.toMatch(/sample-/);
  });
});
