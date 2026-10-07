import { describe, expect, it } from 'vitest';

import { attr, distFiles, publicSlugs, readDist, slugsWithFlag, tags } from './dist-files';

const html = distFiles('.html');

/**
 * Giá trị flag đã che hợp lệ (sau khi giải mã HTML entity): `<redacted>`, `redacted`,
 * `REDACTED`, `<REDACTED>`. Mọi flag THM{…}/HTB{…} khác đều là flag lộ → fail.
 */
const REDACTED = /^<?redacted>?$/i;

function decode(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

describe('không lộ flag chưa che', () => {
  it.each(html)('$path', ({ content }) => {
    const matches = [...content.matchAll(/(THM|HTB)\{([^}]*)\}/g)];
    for (const m of matches) {
      const inner = decode(m[2] ?? '').trim();
      expect(REDACTED.test(inner), `flag chưa che: ${m[0]}`).toBe(true);
    }
  });
});

describe('khung write-up', () => {
  it('trang danh sách build ra ở cả hai ngôn ngữ', () => {
    expect(() => readDist('writeups.html')).not.toThrow();
    expect(() => readDist('en/writeups.html')).not.toThrow();
  });

  it('fixture build ra trang chi tiết', () => {
    expect(() => readDist('writeups/sample-writeup.html')).not.toThrow();
    expect(() => readDist('en/writeups/sample-writeup.html')).not.toThrow();
  });

  it('draft KHÔNG build ra trang chi tiết', () => {
    expect(() => readDist('writeups/sample-draft.html')).toThrow();
    expect(() => readDist('en/writeups/sample-draft.html')).toThrow();
  });

  it('fixture KHÔNG hiện ở trang danh sách', () => {
    expect(readDist('writeups.html')).not.toMatch(/sample-writeup/);
    expect(readDist('en/writeups.html')).not.toMatch(/sample-writeup/);
  });

  // Mỗi trang danh sách chỉ liệt kê bài có bản ngôn ngữ đó thật (translation: done), không fixture/draft.
  describe.each([
    ['vi', 'writeups.html', '/writeups/'],
    ['en', 'en/writeups.html', '/en/writeups/'],
  ] as const)('danh sách %s', (locale, file, prefix) => {
    const listed = [...readDist(file).matchAll(/href="([^"#?]+)"/g)]
      .map((m) => m[1] ?? '')
      .filter((h) => h.startsWith(prefix))
      .map((h) => h.slice(prefix.length))
      .sort();

    it('đúng tập bài công khai của ngôn ngữ, không thừa không thiếu', () => {
      expect(listed).toEqual(publicSlugs(locale));
    });

    it('KHÔNG chứa fixture', () => {
      for (const slug of slugsWithFlag(locale, 'fixture: true')) expect(listed).not.toContain(slug);
    });

    it(`KHÔNG chứa bài ${locale} chưa dịch (translation: pending)`, () => {
      for (const slug of slugsWithFlag(locale, 'translation: pending'))
        expect(listed, slug).not.toContain(slug);
    });
  });

  it('khối code được Prism tô màu (class .token.*), không chỉ vắng style=', () => {
    const page = readDist('writeups/sample-writeup.html');
    expect(page).toMatch(/class="token /);
  });

  it('trang chi tiết có mục lục từ h2/h3', () => {
    const page = readDist('writeups/sample-writeup.html');
    const toc = tags(page, 'nav').find((n) => attr(n, 'aria-label') === 'Mục lục');
    expect(toc, 'thiếu <nav> mục lục').toBeTruthy();
    expect(page).toMatch(/href="#bước-đầu-tiên"/);
  });

  // PrevNext chỉ render khi có ≥ 2 bài công khai: kiểm tra mọi trang write-up, áp dụng khi có.
  it.each(html.filter((f) => /^(?:en\/)?writeups\/.+\.html$/.test(f.path)))(
    '$path: các <nav> không trùng nhãn, nav bài trước/sau có nhãn đúng',
    ({ path, content }) => {
      const navs = tags(content, 'nav');
      const labels = navs.map((n) => attr(n, 'aria-label'));
      expect(new Set(labels).size, labels.join(' | ')).toBe(labels.length);
      const expected = path.startsWith('en/')
        ? 'Previous and next write-ups'
        : 'Bài trước và bài sau';
      for (const nav of navs.filter((n) => /class="prevnext/.test(n))) {
        expect(attr(nav, 'aria-label')).toBe(expected);
      }
    },
  );

  it('nút sao chép dùng script ngoài /copy-code.js', () => {
    expect(readDist('writeups/sample-writeup.html')).toMatch(/src="\/copy-code\.js"/);
  });
});

describe('bản tiếng Anh pending', () => {
  const page = readDist('en/writeups/sample-pending.html');

  it('noindex', () => {
    const robots = tags(page, 'meta').find((m) => attr(m, 'name') === 'robots');
    expect(robots && attr(robots, 'content')).toBe('noindex');
  });

  it('không khai báo <link alternate hreflang> cho cặp này', () => {
    const alternates = tags(page, 'link').filter(
      (l) => attr(l, 'rel') === 'alternate' && attr(l, 'hreflang'),
    );
    expect(alternates).toHaveLength(0);
  });

  it('có liên kết sang bản tiếng Việt', () => {
    const links = tags(page, 'a').map((a) => attr(a, 'href'));
    expect(links).toContain('/writeups/sample-pending');
  });

  it('bản tiếng Việt của bài đó vẫn index bình thường', () => {
    const vi = readDist('writeups/sample-pending.html');
    expect(vi).not.toMatch(/<meta name="robots"/);
    const canonical = tags(vi, 'link').filter((l) => attr(l, 'rel') === 'canonical');
    expect(canonical).toHaveLength(1);
  });
});
