import { describe, expect, it } from 'vitest';

import {
  attr,
  distFiles,
  frontmatterList,
  frontmatterValue,
  isCleanUrl,
  isNoindex,
  isNotFound,
  pageUrl,
  publicSlugs,
  SITE,
  slugsWithFlag,
  tags,
  textOf,
} from './dist-files';

const html = distFiles('.html');
const pages = html.filter((f) => !isNoindex(f.content));
const noindex = html.filter((f) => isNoindex(f.content));
/** URL của mọi trang index được: hreflang chỉ được trỏ vào đây. */
const indexable = new Set(pages.map((f) => pageUrl(f.path)));

const localeOfPath = (path: string): 'vi' | 'en' =>
  path === 'en.html' || path.startsWith('en/') ? 'en' : 'vi';

/** Giá trị `content` của mọi `<meta property|name=key>`. */
const metas = (content: string, key: string): string[] =>
  tags(content, 'meta')
    .filter((m) => attr(m, 'property') === key || attr(m, 'name') === key)
    .map((m) => attr(m, 'content') ?? '');

/** Giải mã entity HTML hay gặp, để so chữ trong thẻ với chữ trong thuộc tính. */
const decode = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const hreflangs = (content: string): Record<string, string | undefined> =>
  Object.fromEntries(
    tags(content, 'link')
      .filter((l) => attr(l, 'rel') === 'alternate' && attr(l, 'hreflang'))
      .map((l) => [attr(l, 'hreflang'), attr(l, 'href')]),
  );

const WRITEUP = /^(en\/)?writeups\/([^/]+)\.html$/;
/** Trang chi tiết write-up có nội dung (không phải bản en pending): phải là `og:type=article`. */
function articleSource(path: string): { slug: string; locale: 'vi' | 'en' } | undefined {
  const m = WRITEUP.exec(path);
  if (!m?.[2]) return undefined;
  const locale = m[1] ? 'en' : 'vi';
  if (locale === 'en' && slugsWithFlag('en', 'translation: pending').includes(m[2]))
    return undefined;
  return { slug: m[2], locale };
}

describe('canonical và hreflang', () => {
  it('có cả 404 vi và en', () => {
    expect(html.filter((f) => isNotFound(f.path)).map((f) => f.path)).toEqual([
      '404.html',
      'en/404.html',
    ]);
  });

  it.each(pages)('$path', ({ path, content }) => {
    const canonical = tags(content, 'link').filter((l) => attr(l, 'rel') === 'canonical');
    expect(canonical).toHaveLength(1);
    const href = attr(canonical[0] ?? '', 'href');
    expect(isCleanUrl(href), href).toBe(true);
    expect(href).toBe(pageUrl(path));

    // hreflang chỉ cho bản ngôn ngữ có thật, index được (ADR 0015): bài chỉ có en không trỏ sang vi 404.
    const alternates = hreflangs(content);
    const langs = Object.keys(alternates).filter((l) => l !== 'x-default');
    expect(
      langs.every((l) => l === 'vi' || l === 'en'),
      langs.join(),
    ).toBe(true);
    expect(langs).toContain(localeOfPath(path));
    expect(alternates[localeOfPath(path)]).toBe(href);
    for (const target of Object.values(alternates)) {
      expect(
        indexable.has(target ?? ''),
        `hreflang trỏ tới trang không index được: ${target}`,
      ).toBe(true);
    }
    expect(alternates['x-default']).toBe(alternates.vi ?? alternates.en);

    // Hai chiều: mỗi bản kia khai báo đúng cùng tập hreflang.
    for (const target of Object.values(alternates)) {
      const other = pages.find((f) => pageUrl(f.path) === target);
      expect(other && hreflangs(other.content)).toEqual(alternates);
    }
  });

  it.each(noindex)('$path: noindex, không canonical/hreflang/og:url', ({ content }) => {
    expect(content).not.toMatch(/rel="canonical"/);
    expect(Object.keys(hreflangs(content))).toHaveLength(0);
    expect(metas(content, 'og:url')).toHaveLength(0);
  });

  // Danh sách rỗng là hợp lệ (mọi bài đã dịch): không khẳng định phải có bài chỉ-en, chỉ kiểm khi có.
  it('bài chỉ có bản en (vi draft/pending) không khai hreflang vi', () => {
    const vi = publicSlugs('vi');
    const enOnly = publicSlugs('en').filter((s) => !vi.includes(s));
    enOnly.forEach((slug) => {
      const page = html.find((f) => f.path === `en/writeups/${slug}.html`);
      expect(page, slug).toBeDefined();
      const alternates = hreflangs(page?.content ?? '');
      expect(Object.keys(alternates).sort(), slug).toEqual(['en', 'x-default']);
      expect(alternates['x-default'], slug).toBe(`${SITE}/en/writeups/${slug}`);
    });
  });
});

describe('meta cơ bản của trang index được', () => {
  it.each(pages)('$path', ({ path, content }) => {
    expect(tags(content, 'title')).toHaveLength(1);
    const title = textOf(content, 'title');
    expect(title.trim()).not.toBe('');
    expect(metas(content, 'og:title').map(decode)).toEqual([decode(title)]);

    const description = metas(content, 'description');
    expect(description).toHaveLength(1);
    expect(description[0]?.trim()).not.toBe('');
    expect(metas(content, 'og:description')).toEqual(description);

    expect(metas(content, 'og:url')).toEqual([pageUrl(path)]);
    const image = metas(content, 'og:image');
    expect(image).toHaveLength(1);
    expect(new URL(image[0] ?? '').origin).toBe(SITE);

    const sitemap = tags(content, 'link').filter((l) => attr(l, 'rel') === 'sitemap');
    expect(sitemap.map((l) => attr(l, 'href'))).toEqual(['/sitemap.xml']);
  });
});

describe('og:type', () => {
  it.each(html)('$path', ({ path, content }) => {
    const source = articleSource(path);
    if (!source) {
      expect(metas(content, 'og:type')).toEqual(['website']);
      expect(content).not.toMatch(/property="article:/);
      return;
    }
    expect(metas(content, 'og:type')).toEqual(['article']);
    // Chỉ ngày YYYY-MM-DD, không giờ (review M6a-2 L6).
    const day = (raw: string | undefined) => new Date(raw ?? '').toISOString().slice(0, 10);
    expect(metas(content, 'article:published_time')).toEqual([
      day(frontmatterValue(source.slug, source.locale, 'date')),
    ]);
    const updated = frontmatterValue(source.slug, source.locale, 'updated');
    expect(metas(content, 'article:modified_time')).toEqual(updated ? [day(updated)] : []);
    const expectedTags = frontmatterList(source.slug, source.locale, 'tags');
    expect(expectedTags.length).toBeGreaterThan(0);
    expect(metas(content, 'article:tag').map(decode)).toEqual(expectedTags);
  });

  it('có trang write-up là article (kiểm tra không rỗng)', () => {
    expect(html.filter((f) => articleSource(f.path)).length).toBeGreaterThan(10);
  });
});
