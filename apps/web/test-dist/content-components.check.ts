import { describe, expect, it } from 'vitest';

import { attr, readDist, tags } from './dist-files';

// Callout và AttackChain trong MDX (ADR 0012). Nhãn mong đợi ghi cứng ở đây (không dùng lại
// từ điển của site) để test độc lập với code đang kiểm tra.
const labels = {
  vi: { tldr: 'TL;DR', critical: 'Nghiêm trọng', insight: 'Điểm mấu chốt', fix: 'Khắc phục' },
  en: { tldr: 'TL;DR', critical: 'Critical', insight: 'Insight', fix: 'Fix' },
} as const;

const page = (locale: 'vi' | 'en', slug: string) =>
  readDist(`${locale === 'vi' ? '' : 'en/'}writeups/${slug}.html`);

/** Phần tử `<tag>` bắt đầu tại `start`, tính cả thẻ con cùng tên lồng nhau. */
function element(html: string, start: number, tag: string): string {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error(`<${tag}> không đóng`);
}

interface Callout {
  type: string;
  label: string;
  html: string;
}

function callouts(html: string): Callout[] {
  return [...html.matchAll(/<div class="callout callout--([a-z]+)"[^>]*>/g)].map((m) => {
    const block = element(html, m.index, 'div');
    const label = /<p class="label"[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/.exec(block)?.[1];
    return { type: m[1] ?? '', label: label ?? '', html: block };
  });
}

function chains(html: string): string[] {
  return [...html.matchAll(/<svg class="chain"[^>]*>/g)].map((m) => element(html, m.index, 'svg'));
}

/** Class của từng bước (`step` / `step step--critical`) theo thứ tự. */
const stepClasses = (svg: string): string[] =>
  tags(svg, 'g')
    .map((g) => attr(g, 'class') ?? '')
    .filter((c) => c.split(' ').includes('step'));

function expectSafe(fragment: string): void {
  expect(fragment).not.toMatch(/\sstyle\s*=/i);
  expect(fragment).not.toMatch(/<script\b/i);
  expect(fragment).not.toMatch(/\son[a-z]+\s*=/i);
}

describe.each(['vi', 'en'] as const)('ValenFind (%s)', (locale) => {
  const html = page(locale, 'valenfind');

  it('có callout TL;DR, critical, insight, fix với nhãn đúng ngôn ngữ', () => {
    const found = callouts(html);
    expect(found.map((c) => c.type)).toEqual(['tldr', 'insight', 'critical', 'fix']);
    for (const c of found) {
      expect(c.label).toBe(labels[locale][c.type as keyof (typeof labels)['vi']]);
      expect(attr(tags(c.html, 'div')[0] ?? '', 'role')).toBe('note');
      expectSafe(c.html);
    }
  });

  it('có một sơ đồ chuỗi tấn công 5 bước, chỉ bước cuối critical', () => {
    const svgs = chains(html);
    expect(svgs).toHaveLength(1);
    const svg = svgs[0] ?? '';
    const open = tags(svg, 'svg')[0] ?? '';
    expect(attr(open, 'role')).toBe('img');
    expect(attr(open, 'aria-label')?.trim()).toBeTruthy();
    expect(stepClasses(svg)).toEqual(['step', 'step', 'step', 'step', 'step step--critical']);
    expectSafe(svg);
  });

  it('sơ đồ ở đầu bài: ngay sau callout TL;DR, trước mục kế tiếp', () => {
    const tldrAt = html.indexOf('callout--tldr');
    const chainAt = html.indexOf('<svg class="chain"');
    const nextH2 = html.indexOf('<h2', tldrAt);
    expect(tldrAt).toBeGreaterThan(-1);
    expect(chainAt).toBeGreaterThan(tldrAt);
    expect(chainAt).toBeLessThan(nextH2);
  });
});

describe.each(['vi', 'en'] as const)('fixture sample-writeup (%s)', (locale) => {
  const html = page(locale, 'sample-writeup');

  it('đủ 5 loại callout, title ghi đè nhãn của note', () => {
    const found = callouts(html);
    expect(found.map((c) => c.type)).toEqual(['tldr', 'critical', 'insight', 'note', 'fix']);
    const note = found.find((c) => c.type === 'note');
    expect(note?.label).toBe(locale === 'vi' ? 'Ghi chú tùy chỉnh' : 'Custom note');
    for (const c of found) expectSafe(c.html);
  });

  it('bước đánh dấu critical ở giữa thay cho bước cuối', () => {
    const svg = chains(html)[0] ?? '';
    expect(stepClasses(svg)).toEqual(['step', 'step step--critical', 'step']);
    expectSafe(svg);
  });
});
