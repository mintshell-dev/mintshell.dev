import { describe, expect, it } from 'vitest';

import { attr, distFiles, readDist, tags } from './dist-files';

const html = distFiles('.html');

/** Mọi khối `<svg>…</svg>` nội tuyến trong một trang. */
const inlineSvgs = (content: string): string[] =>
  [...content.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((m) => m[0]);

/** Thẻ mở `<svg>` của BrandMark theo biến thể. */
const brandMarks = (content: string, variant: 'mark' | 'avatar'): string[] =>
  tags(content, 'svg').filter((s) =>
    attr(s, 'class')?.split(' ').includes(`brand-mark--${variant}`),
  );

describe('BrandMark trong header (mọi trang, kể cả 404)', () => {
  it.each(html)('$path', ({ content }) => {
    const header = /<header\b[\s\S]*?<\/header>/.exec(content)?.[0] ?? '';
    const marks = brandMarks(header, 'mark');
    expect(marks).toHaveLength(1);
    expect(attr(marks[0] ?? '', 'aria-hidden')).toBe('true');
  });
});

describe.each(['portfolio.html', 'en/portfolio.html'])('BrandMark avatar: %s', (path) => {
  it('có bản avatar trong phần liên hệ, ẩn với trình đọc màn hình', () => {
    const content = readDist(path);
    const contact = /<section\b[^>]*\sid="lien-he"[\s\S]*?<\/section>/.exec(content)?.[0] ?? '';
    const avatars = brandMarks(contact, 'avatar');
    expect(avatars).toHaveLength(1);
    expect(attr(avatars[0] ?? '', 'aria-hidden')).toBe('true');
  });
});

describe('SVG nội tuyến an toàn', () => {
  it.each(html)('$path', ({ content }) => {
    const svgs = inlineSvgs(content);
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg).not.toMatch(/<script\b/i);
      expect(svg).not.toMatch(/<foreignObject\b/i);
      expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
      expect(svg).not.toMatch(/\sstyle\s*=/i);
      expect(svg).not.toMatch(/<metadata\b|c2pa/i);
      // Không tham chiếu ra ngoài: không href/src/url(), không URL có scheme hay `//`.
      expect(svg).not.toMatch(/\s(?:xlink:)?href\s*=|\ssrc\s*=|url\(/i);
      expect(svg).not.toMatch(/(?:[a-z][a-z0-9+.-]*:)?\/\//i);
      // Màu chỉ đến từ CSS (token), không ghi cứng trong thuộc tính.
      expect(svg).not.toMatch(/\s(?:fill|stroke)="(?!none|currentColor")[^"]*"/);
    }
  });
});
