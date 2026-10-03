import { describe, expect, it } from 'vitest';

import { localeFromPath, localizePath, stripLocale } from './paths.ts';

describe('localeFromPath', () => {
  it.each([
    ['/', 'vi'],
    ['/writeups', 'vi'],
    ['/english', 'vi'],
    ['/en', 'en'],
    ['/en/', 'en'],
    ['/en/writeups/sqli-blind-time-based', 'en'],
    ['/en.html', 'en'],
    ['/en/404.html', 'en'],
    ['/404.html', 'vi'],
  ])('%s → %s', (path, locale) => {
    expect(localeFromPath(path)).toBe(locale);
  });
});

describe('stripLocale', () => {
  it.each([
    ['/', '/'],
    ['/en', '/'],
    ['/en/', '/'],
    ['/en/writeups', '/writeups'],
    ['/writeups/', '/writeups'],
    ['/english', '/english'],
  ])('%s → %s', (path, base) => {
    expect(stripLocale(path)).toBe(base);
  });
});

describe('localizePath', () => {
  it.each([
    ['/', 'en', '/en'],
    ['/en', 'vi', '/'],
    ['/en/', 'vi', '/'],
    ['/writeups', 'en', '/en/writeups'],
    ['/en/writeups', 'vi', '/writeups'],
    ['/cheatsheets/xss-payloads', 'en', '/en/cheatsheets/xss-payloads'],
    ['/en/portfolio', 'en', '/en/portfolio'],
    ['/portfolio', 'vi', '/portfolio'],
    ['/writeups/', 'en', '/en/writeups'],
    ['/english', 'en', '/en/english'],
    // Pathname lúc build với format: 'file'.
    ['/index.html', 'en', '/en'],
    ['/en.html', 'vi', '/'],
    ['/en/index.html', 'vi', '/'],
    ['/writeups.html', 'en', '/en/writeups'],
    ['/en/writeups.html', 'vi', '/writeups'],
    ['/en/writeups.html', 'en', '/en/writeups'],
  ] as const)('%s sang %s → %s', (path, locale, expected) => {
    expect(localizePath(path, locale)).toBe(expected);
  });

  it('khứ hồi vi → en → vi giữ nguyên slug', () => {
    for (const path of ['/', '/writeups', '/writeups/sqli-blind-time-based']) {
      expect(localizePath(localizePath(path, 'en'), 'vi')).toBe(path);
    }
  });

  it('không bao giờ trả về URL protocol-relative', () => {
    for (const locale of ['vi', 'en'] as const) {
      for (const path of [
        '//evil.example',
        '///evil.example/x',
        '/en//evil.example',
        '/\\evil.example',
        '\\\\evil.example',
        '/en/\\evil.example',
        '/\t/evil.example',
        '/\n/evil.example',
      ]) {
        const result = localizePath(path, locale);
        expect(result.startsWith('/')).toBe(true);
        // Trình duyệt hiểu `\` như `/` và bỏ tab/CR/LF: không được còn dạng `//host`.
        expect(result).not.toMatch(/^[/\\]{2}|[\\\t\n\r]/);
      }
    }
  });
});
