import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { attr, DIST, publicSlugs, readDist, tags } from './dist-files';

const PAGEFIND = new URL('pagefind/', DIST);

/** URL của mọi trang trong chỉ mục: fragment là JSON gzip, có tiền tố `pagefind_dcd`. */
function indexedUrls(): string[] {
  const dir = new URL('fragment/', PAGEFIND);
  return readdirSync(dir)
    .map((name) => {
      const raw = gunzipSync(readFileSync(new URL(name, dir))).toString('utf8');
      return (JSON.parse(raw.slice(raw.indexOf('{'))) as { url: string }).url;
    })
    .sort();
}

describe('chỉ mục Pagefind', () => {
  it('đã được tạo (chạy search:index sau build)', () => {
    expect(existsSync(new URL('pagefind.js', PAGEFIND))).toBe(true);
    expect(existsSync(new URL('pagefind-entry.json', PAGEFIND))).toBe(true);
  });

  it('tách index theo ngôn ngữ vi, en', () => {
    const entry = JSON.parse(readFileSync(new URL('pagefind-entry.json', PAGEFIND), 'utf8'));
    expect(Object.keys(entry.languages).sort()).toEqual(['en', 'vi']);
  });

  it('chỉ index write-up công khai (không fixture, draft, pending, trang khác)', () => {
    const expected = [
      ...publicSlugs('vi').map((s) => `/writeups/${s}.html`),
      ...publicSlugs('en').map((s) => `/en/writeups/${s}.html`),
    ].sort();
    expect(indexedUrls()).toEqual(expected);
  });

  // Allowlist riêng của test (không import từ script): bundle UI, highlight… không được deploy.
  it('chỉ còn file lõi Pagefind (không UI, highlight)', () => {
    const core =
      /^(?:pagefind\.js|pagefind-worker\.js|pagefind-entry\.json|pagefind\.[\w-]+\.pf_meta|wasm\.[\w-]+\.pagefind|fragment|index|filter)$/;
    const extra = readdirSync(PAGEFIND).filter((n) => !core.test(n));
    expect(extra).toEqual([]);
  });
});

describe.each([
  ['search.html', 'vi'],
  ['en/search.html', 'en'],
])('trang %s', (path, lang) => {
  const page = readDist(path);

  it(`lang="${lang}", có ô tìm kiếm có nhãn`, () => {
    expect(attr(tags(page, 'html')[0] ?? '', 'lang')).toBe(lang);
    const input = tags(page, 'input').find((i) => attr(i, 'type') === 'search');
    expect(input, 'thiếu input[type=search]').toBeTruthy();
    const id = attr(input ?? '', 'id');
    expect(tags(page, 'label').some((l) => attr(l, 'for') === id)).toBe(true);
  });

  it('script chỉ từ cùng origin, không CDN', () => {
    for (const script of tags(page, 'script')) {
      expect(attr(script, 'src'), script).toMatch(/^\/(?![/\\])/);
    }
    // Tài nguyên được TẢI (src=, stylesheet/preload) chỉ cùng origin; link điều hướng ra ngoài thì được.
    expect(page).not.toMatch(/\ssrc="(?:[a-z][a-z0-9+.-]*:|\/\/)/i);
    const loaded = tags(page, 'link').filter((l) =>
      /^(?:stylesheet|preload|modulepreload)$/.test(attr(l, 'rel') ?? ''),
    );
    for (const link of loaded) expect(attr(link, 'href'), link).toMatch(/^\/(?![/\\])/);
  });
});
