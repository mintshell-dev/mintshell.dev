import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { pairedSlugs, pairMismatches } from './dist-files';

/**
 * Hai bản vi/en của một bài được soạn ở hai dòng Notion riêng (cùng Slug, khác Version) nên dễ lệch.
 * Đọc thẳng nguồn (không cần build), chạy trong `pnpm test`; áp cả cho bài draft.
 */

describe('cặp vi/en khớp nhau (content/writeups thật)', () => {
  it.each(pairedSlugs())('%s', (slug) => {
    expect(pairMismatches(slug), `${slug}: các trường lệch giữa vi.mdx và en.mdx`).toEqual([]);
  });
});

describe('pairMismatches', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  const base: Record<string, string> = {
    title: "'Tiêu đề'",
    description: "'Mô tả'",
    date: '2026-10-05',
    platform: 'tryhackme',
    room: "'Room'",
    roomUrl: "'https://tryhackme.com/room/x'",
    difficulty: 'easy',
    tags: '[web, sqli]',
    vulnClasses: '\n  - SQL injection',
    translation: 'done',
    draft: 'false',
  };

  function fixture(vi: Record<string, string>, en: Record<string, string>): URL {
    const root = mkdtempSync(join(tmpdir(), 'pairs-'));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(root, 'bai'));
    const body = (over: Record<string, string>) =>
      `---\n${Object.entries({ ...base, ...over })
        .map(([k, v]) => `${k}: ${v}`.replace(': \n', ':\n'))
        .join('\n')}\n---\n\nnội dung\n`;
    writeFileSync(join(root, 'bai', 'vi.mdx'), body(vi));
    writeFileSync(join(root, 'bai', 'en.mdx'), body(en));
    return pathToFileURL(`${root}/`);
  }

  it('khác title/description/draft/translation và khác kiểu nháy → không báo', () => {
    const dir = fixture(
      { title: "'Tiêu đề vi'", description: "'Mô tả vi'", room: '"Room"', tags: '["web", sqli]' },
      { title: "'Title en'", description: "'Desc en'", draft: 'true', translation: 'pending' },
    );
    expect(pairMismatches('bai', dir)).toEqual([]);
  });

  it('lệch date, room, tags, vulnClasses → báo đúng tên trường', () => {
    const dir = fixture(
      {},
      { date: '2026-10-06', room: "'Khác'", tags: '[web]', vulnClasses: '[XSS]' },
    );
    expect(pairMismatches('bai', dir)).toEqual(['date', 'room', 'tags', 'vulnClasses']);
  });

  it('chỉ một bên có updated → báo', () => {
    const dir = fixture({}, { updated: '2026-10-07' });
    expect(pairMismatches('bai', dir)).toEqual(['updated']);
  });
});
