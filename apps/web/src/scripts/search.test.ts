import { describe, expect, it } from 'vitest';

import { excerptParts, resultHref } from './search';

describe('resultHref', () => {
  it.each([
    ['/writeups/valenfind.html', '/writeups/valenfind'],
    ['/en/writeups/valenfind.html', '/en/writeups/valenfind'],
    ['/en/writeups/valenfind.html#buoc-1', '/en/writeups/valenfind#buoc-1'],
    ['/writeups/x', '/writeups/x'],
  ])('%s → %s', (url, href) => {
    expect(resultHref(url)).toBe(href);
  });

  it.each([
    'https://evil.example/x',
    '//evil.example/x',
    '/\\evil.example',
    'javascript:alert(1)',
    'writeups/x',
    '/ /evil',
    '',
  ])('từ chối %j', (url) => {
    expect(resultHref(url)).toBeUndefined();
  });
});

describe('excerptParts', () => {
  it('tách <mark> và giải mã entity thành chữ thuần', () => {
    expect(excerptParts('a &lt;b&gt; <mark>path</mark> &amp; c')).toEqual([
      { text: 'a <b> ', mark: false },
      { text: 'path', mark: true },
      { text: ' & c', mark: false },
    ]);
  });

  it('thẻ khác <mark> chỉ là chữ, không thành phần tử', () => {
    expect(excerptParts('<img src=x onerror=alert(1)>')).toEqual([
      { text: '<img src=x onerror=alert(1)>', mark: false },
    ]);
  });
});
