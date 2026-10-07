import { describe, expect, it } from 'vitest';

import { escapeXml, sitemapXml, xDefault } from './seo';

const site = new URL('https://mintshell.dev');

describe('xDefault', () => {
  it('ưu tiên vi', () => {
    expect(xDefault(['vi', 'en'])).toBe('vi');
    expect(xDefault(['en', 'vi'])).toBe('vi');
  });

  it('bài chỉ có en → en', () => {
    expect(xDefault(['en'])).toBe('en');
  });

  it('không có bản nào → lỗi', () => {
    expect(() => xDefault([])).toThrow();
  });
});

describe('escapeXml', () => {
  it('escape đủ & < > " \'', () => {
    expect(escapeXml(`a&b<c>"d'e`)).toBe('a&#38;b&#60;c&#62;&#34;d&#39;e');
  });

  it('không escape hai lần chuỗi đã sạch', () => {
    expect(escapeXml('https://mintshell.dev/writeups/binex')).toBe(
      'https://mintshell.dev/writeups/binex',
    );
  });
});

describe('sitemapXml', () => {
  it('cặp vi/en: mỗi bản một <url>, hreflang hai chiều + x-default', () => {
    const xml = sitemapXml([{ path: '/writeups/binex', locales: ['en', 'vi'] }], site);
    const urls = xml.split('<url>').slice(1);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('<loc>https://mintshell.dev/writeups/binex</loc>');
    expect(urls[1]).toContain('<loc>https://mintshell.dev/en/writeups/binex</loc>');
    for (const url of urls) {
      expect(url).toContain('hreflang="vi" href="https://mintshell.dev/writeups/binex"');
      expect(url).toContain('hreflang="en" href="https://mintshell.dev/en/writeups/binex"');
      expect(url).toContain('hreflang="x-default" href="https://mintshell.dev/writeups/binex"');
    }
  });

  it('bài một ngôn ngữ: không hreflang (không trỏ tới bản không tồn tại)', () => {
    const xml = sitemapXml([{ path: '/writeups/nax', locales: ['en'] }], site);
    expect(xml).toContain('<loc>https://mintshell.dev/en/writeups/nax</loc>');
    expect(xml).not.toContain('xhtml:link');
    expect(xml).not.toContain('https://mintshell.dev/writeups/nax<');
  });

  it('trang chủ: / và /en', () => {
    const xml = sitemapXml([{ path: '/', locales: ['vi', 'en'] }], site);
    expect(xml).toContain('<loc>https://mintshell.dev/</loc>');
    expect(xml).toContain('<loc>https://mintshell.dev/en</loc>');
  });

  it('lastmod YYYY-MM-DD theo từng bản, trang không có ngày thì bỏ', () => {
    const xml = sitemapXml(
      [
        { path: '/writeups/a', locales: ['vi'], lastmod: { vi: new Date('2026-10-05') } },
        { path: '/portfolio', locales: ['vi'] },
      ],
      site,
    );
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
    expect(xml).toContain('<lastmod>2026-10-05</lastmod>');
  });

  it("escape & và ' trong URL (new URL không percent-encode hai ký tự này)", () => {
    const xml = sitemapXml([{ path: `/a&b'c`, locales: ['vi'] }], site);
    expect(xml).toContain('<loc>https://mintshell.dev/a&#38;b&#39;c</loc>');
  });

  it('khai báo namespace sitemap và xhtml', () => {
    const xml = sitemapXml([], site);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });
});
