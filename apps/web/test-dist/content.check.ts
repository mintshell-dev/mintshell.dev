import { describe, expect, it } from 'vitest';

import { attr, distFiles, readDist, tags, textOf } from './dist-files';

const html = distFiles('.html');

/** Chữ của đoạn giấy phép trong footer (đoạn thứ hai). */
function licenseLine(content: string): string {
  const footer = /<footer\b[\s\S]*?<\/footer>/i.exec(content)?.[0] ?? '';
  const paragraphs = [...footer.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  return (paragraphs[1]?.[1] ?? '').replace(/<[^>]+>/g, '');
}

describe('footer', () => {
  it('tiếng Việt có khoảng trắng đúng', () => {
    expect(licenseLine(readDist('index.html'))).toBe(
      'Giấy phép: MIT (mã nguồn) · CC BY 4.0 (nội dung)',
    );
  });

  it('tiếng Anh có khoảng trắng đúng', () => {
    expect(licenseLine(readDist('en.html'))).toBe('License: MIT (code) · CC BY 4.0 (content)');
  });

  it.each(html)('$path: khoảng trắng sau ":" và quanh "·"', ({ content }) => {
    const line = licenseLine(content);
    expect(line).not.toBe('');
    expect(line).not.toMatch(/:\S/);
    expect(line).not.toMatch(/\S·|·\S/);
  });
});

describe('skip link', () => {
  it.each(html)('$path: trỏ tới <main id="main">, main không có tabindex', ({ content }) => {
    const skip = tags(content, 'a').find((a) => attr(a, 'class')?.includes('skip-link'));
    expect(skip && attr(skip, 'href')).toBe('#main');
    const main = tags(content, 'main');
    expect(main).toHaveLength(1);
    expect(attr(main[0] ?? '', 'id')).toBe('main');
    expect(main[0]).not.toMatch(/tabindex/i);
  });
});

describe('trang 404 song ngữ', () => {
  it.each([
    ['404.html', 'en', '/en'],
    ['en/404.html', 'vi', '/'],
  ])('%s: đoạn ngôn ngữ còn lại có lang="%s" và link tới %s', (path, lang, home) => {
    const content = readDist(path);
    const other = new RegExp(`<p\\b[^>]*\\slang="${lang}"[^>]*>([\\s\\S]*?)</p>`, 'i').exec(
      content,
    );
    expect(other, `thiếu <p lang="${lang}">`).not.toBeNull();
    const links = tags(other?.[1] ?? '', 'a');
    expect(links.map((a) => attr(a, 'href'))).toEqual([home]);
  });

  it('tiêu đề 404 có ở cả hai bản', () => {
    expect(textOf(readDist('404.html'), 'h1')).toBe('404');
    expect(textOf(readDist('en/404.html'), 'h1')).toBe('404');
  });
});
