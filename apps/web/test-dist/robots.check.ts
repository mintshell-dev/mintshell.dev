import { describe, expect, it } from 'vitest';

import { readDist, SITE } from './dist-files';

/** `robots.txt` (nguồn: `public/robots.txt`, ADR 0015). */
const lines = readDist('robots.txt')
  .split('\n')
  .map((l) => l.replace(/#.*/, '').trim())
  .filter(Boolean);
const field = (name: string): string[] =>
  lines
    .filter((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`))
    .map((l) => l.slice(name.length + 1).trim());

describe('robots.txt', () => {
  it('một nhóm cho mọi user-agent', () => {
    expect(field('User-agent')).toEqual(['*']);
  });

  it('trỏ đúng một sitemap, URL tuyệt đối', () => {
    expect(field('Sitemap')).toEqual([`${SITE}/sitemap.xml`]);
  });

  it('chỉ chặn /pagefind/, không chặn cả site', () => {
    expect(field('Disallow')).toEqual(['/pagefind/']);
    expect(field('Allow')).toEqual([]);
  });

  it('không có chỉ thị lạ', () => {
    for (const l of lines) expect(l, l).toMatch(/^(User-agent|Disallow|Sitemap):/i);
  });
});
