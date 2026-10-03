import { describe, expect, it } from 'vitest';

import { attr, distFiles, isNotFound, SITE, tags } from './dist-files';

const html = distFiles('.html');
const pages = html.filter((f) => !isNotFound(f.path));
const notFound = html.filter((f) => isNotFound(f.path));

/** URL tuyệt đối, đúng domain, không `.html`, không `/` cuối (trừ gốc) (ADR 0007). */
function expectCleanUrl(url: string | undefined): void {
  expect(url).toBeDefined();
  expect(url === `${SITE}/` || url?.startsWith(`${SITE}/`), url).toBe(true);
  expect(url).not.toMatch(/\.html$/);
  if (url !== `${SITE}/`) expect(url).not.toMatch(/\/$/);
}

describe('canonical và hreflang', () => {
  it('có cả 404 vi và en', () => {
    expect(notFound.map((f) => f.path)).toEqual(['404.html', 'en/404.html']);
  });

  it.each(pages)('$path', ({ content }) => {
    const links = tags(content, 'link');
    const canonical = links.filter((l) => attr(l, 'rel') === 'canonical');
    expect(canonical).toHaveLength(1);
    expectCleanUrl(attr(canonical[0] ?? '', 'href'));

    const alternates: Record<string, string | undefined> = Object.fromEntries(
      links
        .filter((l) => attr(l, 'rel') === 'alternate' && attr(l, 'hreflang'))
        .map((l) => [attr(l, 'hreflang'), attr(l, 'href')]),
    );
    expect(Object.keys(alternates).sort()).toEqual(['en', 'vi', 'x-default']);
    for (const href of Object.values(alternates)) expectCleanUrl(href);
    expect(alternates['x-default']).toBe(alternates.vi);
  });

  it.each(notFound)('$path: noindex, không canonical', ({ content }) => {
    expect(content).toMatch(/<meta name="robots" content="noindex"/);
    expect(content).not.toMatch(/rel="canonical"/);
  });
});
