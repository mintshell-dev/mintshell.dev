import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { TITLE_MAX, writeupSchema } from './writeup';

const valid = {
  title: 'ValenFind',
  description: 'mô tả',
  date: '2026-10-04',
  platform: 'tryhackme',
  room: 'ValenFind',
  roomUrl: 'https://tryhackme.com/room/lafb2026e10',
  difficulty: 'medium',
  tags: ['web'],
  vulnClasses: ['path traversal / LFI'],
  translation: 'done',
  draft: false,
};

/** Tiêu đề tiếng Việt có dấu dài đúng `length` ký tự. */
const vietnameseTitle = (length: number): string =>
  'Đọc file bằng quyền root rồi chiếm toàn bộ tài khoản '.repeat(10).slice(0, length);

describe('writeupSchema: title (bố cục ảnh OG, ADR 0012)', () => {
  it('nhận frontmatter hợp lệ', () => {
    expect(writeupSchema.safeParse(valid).success).toBe(true);
  });

  it(`nhận tiêu đề đúng ${TITLE_MAX} ký tự (tiếng Việt có dấu)`, () => {
    const title = vietnameseTitle(TITLE_MAX).replace(/ $/, '.');
    expect(title).toHaveLength(TITLE_MAX);
    expect(writeupSchema.safeParse({ ...valid, title }).success).toBe(true);
  });

  it(`từ chối tiêu đề ${TITLE_MAX + 1} ký tự, báo lỗi ở title kèm giới hạn`, () => {
    const title = `${vietnameseTitle(TITLE_MAX)}x`.replace(/ x$/, 'xx');
    expect(title).toHaveLength(TITLE_MAX + 1);
    const result = writeupSchema.safeParse({ ...valid, title });
    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect(issue?.path).toEqual(['title']);
    expect(issue?.message).toContain(String(TITLE_MAX));
  });

  it('khoảng trắng đầu/cuối không tính vào giới hạn', () => {
    const title = `  ${vietnameseTitle(TITLE_MAX).replace(/ $/, '.')}  `;
    expect(writeupSchema.safeParse({ ...valid, title }).success).toBe(true);
  });

  it('từ chối tiêu đề chỉ có khoảng trắng', () => {
    expect(writeupSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
  });

  it.each(['vi', 'en'])('tiêu đề thật của ValenFind (%s) nằm trong giới hạn', (locale) => {
    const source = readFileSync(
      new URL(`../../../../content/writeups/valenfind/${locale}.mdx`, import.meta.url),
      'utf8',
    );
    const title = /^title: '(.*)'$/m.exec(source)?.[1] ?? '';
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
  });
});
