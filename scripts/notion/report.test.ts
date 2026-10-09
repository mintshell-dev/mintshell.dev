import { describe, expect, it } from 'vitest';

import {
  buildAbortReport,
  buildReport,
  type PostResult,
  REMINDER,
  sanitizeTerminal,
  summaryLine,
  totals,
} from './report.ts';

function post(slug: string, over: Partial<PostResult> = {}): PostResult {
  return {
    slug,
    locale: 'vi',
    title: `Bài ${slug}`,
    file: `content/writeups/_import/${slug}/vi.md`,
    images: [],
    imageFailures: [],
    externalSkipped: [],
    findings: [],
    unsupported: [],
    frontmatterWarnings: [],
    otherWarnings: [],
    ...over,
  };
}

const many = [
  post('a', {
    findings: [
      { kind: 'flag', line: 12, match: 'THM{fake}' },
      { kind: 'ip', line: 20, match: '10.10.1.2', note: 'riêng tư' },
    ],
    images: [
      { path: 'content/writeups/_import/a/images/01-x.png', metadata: ['tEXt'] },
      { path: 'content/writeups/_import/a/images/02-y.png', metadata: [] },
    ],
  }),
  ...Array.from({ length: 20 }, (_, i) => post(`filler-${i}`)),
  post('z', {
    findings: [
      { kind: 'prompt', line: 3, match: 'user1@home-pc' },
      { kind: 'path', line: 4, match: '/home/user1' },
      { kind: 'flag', line: 9, match: 'HTB{fake}' },
    ],
    imageFailures: [{ index: 1, reason: 'HTTP 403' }],
    externalSkipped: [{ index: 2, url: 'https://img.example/x.png' }],
    unsupported: ['toggle'],
    frontmatterWarnings: ['thiếu date'],
    otherWarnings: ['link nội bộ Notion'],
  }),
];

describe('báo cáo', () => {
  it('dòng cuối cùng là dòng TỔNG KẾT, cộng dồn mọi bài kể cả khi kéo hàng loạt', () => {
    const report = buildReport(many, [{ label: 'x', reason: 'slug không hợp lệ' }]);
    const last = report.trimEnd().split('\n').at(-1);
    expect(last).toBe(
      'TỔNG KẾT: kéo về 22 bài (bỏ qua 1) · flag 2 · IP 1 · prompt 1 · đường dẫn home 1 · ' +
        'ảnh có metadata 1 · ảnh lỗi 1 · ảnh external không tải 1 · ' +
        `block chưa hỗ trợ 1 · frontmatter 1 · khác 1 — ${REMINDER}`,
    );
    expect(last).toContain(
      'CHƯA xuất bản gì; hãy soát _import/ trước khi chuyển sang content/writeups/',
    );
  });

  it('có file:dòng để nhảy tới, ảnh để tự mở, metadata, mục bỏ qua', () => {
    const report = buildReport(many, [{ label: 'Bài lỗi', reason: 'slug "Bad" không hợp lệ' }]);
    expect(report).toContain('content/writeups/_import/a/vi.md:12  [flag] THM{fake}');
    expect(report).toContain('content/writeups/_import/a/vi.md:20  [ip] 10.10.1.2 (riêng tư)');
    expect(report).toContain('content/writeups/_import/z/vi.md:3  [prompt] user1@home-pc');
    expect(report).toContain('content/writeups/_import/a/images/01-x.png  [metadata: tEXt]');
    expect(report).toContain('[ảnh lỗi] 01: HTTP 403');
    expect(report).toContain('- Bài lỗi: slug "Bad" không hợp lệ');
    expect(report).toMatch(/\| a\/vi +\| 2\/0\/0 +\| 1 +\| 1 +\| 0 +\| 0 +\| 1 /);
    expect(report).toContain(
      '[ảnh external không tải] 02: https://img.example/x.png (tự tải nếu tin host, hoặc chạy lại với --external-images)',
    );
  });

  it('không có bài nào vẫn in tổng kết', () => {
    const report = buildReport([], []);
    expect(report).toContain('Không có bài nào');
    expect(report.trimEnd().split('\n').at(-1)).toBe(summaryLine(totals([], [])));
  });

  it('lọc ký tự điều khiển terminal (ANSI/OSC) trong chuỗi từ Notion, giữ xuống dòng', () => {
    const evil = 'Tiêu đề\x1b[1A\x1b[2K\x1b]52;c;ZXZpbA==\x07';
    const report = buildReport([post('a', { title: evil })], [{ label: evil, reason: 'x' }]);
    // eslint-disable-next-line no-control-regex -- cố ý: kiểm báo cáo không còn ký tự điều khiển
    expect(report).not.toMatch(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
    expect(report).toContain('Tiêu đề');
    expect(sanitizeTerminal('a\nb\x9bc')).toBe('a\nb\uFFFDc');
  });

  it('hai bản cùng slug hiện riêng theo slug/locale', () => {
    const report = buildReport(
      [post('a'), post('a', { locale: 'en', file: 'content/writeups/_import/a/en.md' })],
      [],
    );
    expect(report).toContain('## a/vi — Bài a');
    expect(report).toContain('## a/en — Bài a');
  });
});

describe('báo cáo dừng (dòng Ready thiếu Version)', () => {
  it('liệt kê tên bài + slug, nói rõ chưa ghi gì, lọc ký tự điều khiển', () => {
    const report = buildAbortReport([
      { title: 'Phòng A', slug: 'phong-a' },
      { title: 'Ác\x1b[2K', slug: '' },
    ]);
    expect(report).toContain('2 dòng Status = Ready chưa chọn Version (EN | VI)');
    expect(report).toContain('  - Phòng A — slug "phong-a"');
    expect(report).toContain('slug ""');
    expect(report.trimEnd().split('\n').at(-1)).toMatch(/CHƯA ghi file nào/);
    // eslint-disable-next-line no-control-regex -- cố ý: kiểm báo cáo không còn ký tự điều khiển
    expect(report).not.toMatch(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
  });

  it('chuỗi Notion có xuống dòng/bidi/zero-width không giả được dòng báo cáo (review L3)', () => {
    const fake = 'Bài\n  - bai-khac: đã soát xong, an toàn';
    const report = buildReport(
      [post('a', { title: fake })],
      [{ label: 'x\u202eTXT.exe', reason: 'Version "EN\u200b" lạ' }],
    );
    expect(report.split('\n').filter((l) => l.startsWith('  - bai-khac'))).toEqual([]);
    expect(report).toContain('## a/vi — Bài⏎  - bai-khac: đã soát xong, an toàn');
    expect(report).not.toMatch(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/);
    const abort = buildAbortReport([{ title: 'A\r\n  - B — slug "b"', slug: 'a\u2066' }]);
    expect(abort.split('\n').filter((l) => l.startsWith('  - B'))).toEqual([]);
    expect(abort).toContain('slug "a\uFFFD"');
  });
});
