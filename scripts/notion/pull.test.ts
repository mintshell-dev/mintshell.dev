import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pull, readEnv, writeFailure } from '../notion-pull.ts';
import { API_BASE } from './api.ts';
import pageBlocks from './fixtures/page-blocks.json' with { type: 'json' };
import { REMINDER } from './report.ts';
import { RollbackError } from './swap.ts';
import { id, json, png, properties, response, rt } from './test-helpers.ts';
import type { FetchFn } from './types.ts';

const TOKEN = 'ntn_FAKE_TEST_TOKEN_0000';
const DB = id(0xdb);
const PAGE_OK = id(0xa1);
const PAGE_PUBLISHED = id(0xa2);
const PAGE_BAD_SLUG = id(0xa3);
const PAGE_DUP = id(0xa4);

const slugProp = (s: string) => ({ Slug: { type: 'rich_text', rich_text: [rt(s)] } });

let root: string;
let calls: string[];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'notion-pull-'));
  await mkdir(join(root, 'content/writeups/published-room'), { recursive: true });
  await writeFile(join(root, 'content/writeups/published-room/vi.mdx'), 'đã xuất bản');
  calls = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Notion giả: database, query (2 trang kết quả), block con, ảnh S3 và ảnh ngoài. */
const fakeNotion: FetchFn = async (url, init) => {
  calls.push(url);
  if (url === `${API_BASE}/databases/${DB}`)
    return json({ properties: { Status: { type: 'status' } } });
  if (url === `${API_BASE}/databases/${DB}/query`) {
    const body = JSON.parse(String(init?.body));
    return body.start_cursor
      ? json({
          results: [
            { id: PAGE_BAD_SLUG, properties: properties({ ...slugProp('Bad Slug!') }) },
            { id: PAGE_DUP, properties: properties() },
          ],
          has_more: false,
        })
      : json({
          results: [
            { id: PAGE_OK, properties: properties() },
            { id: PAGE_PUBLISHED, properties: properties({ ...slugProp('published-room') }) },
          ],
          has_more: true,
          next_cursor: 'p2',
        });
  }
  if (url.startsWith(`${API_BASE}/blocks/${PAGE_OK}/children`)) return json(pageBlocks);
  if (url.startsWith(`${API_BASE}/blocks/`)) return json({ results: [], has_more: false });
  if (url.startsWith('https://prod-files-secure.s3.us-west-2.amazonaws.com/')) {
    if (init?.headers) throw new Error('không được gửi header (token) tới host ảnh');
    return response(png(['tEXt']));
  }
  if (url === 'https://img.example/diagram.svg') return response('<svg onload="alert(1)"/>');
  throw new Error(`URL không mong đợi: ${url}`);
};

const run = (force = false) =>
  pull({ token: TOKEN, databaseId: DB, force, root, fetch: fakeNotion });

describe('pull (end-to-end với Notion giả)', () => {
  it('ghi bài vào _import/<slug>/, tải ảnh, báo cáo đủ cảnh báo, không xuất bản gì', async () => {
    const out = await run();
    expect(out.failed).toBe(false);
    expect(out.results.map((r) => r.slug)).toEqual(['sample-room', 'published-room']);

    const dir = join(root, 'content/writeups/_import/sample-room');
    const md = readFileSync(join(dir, 'vi.md'), 'utf8');
    expect(md).toMatch(/^---\ntitle: "Phòng mẫu: SQLi tới RCE"\n/);
    expect(md).toContain('draft: true');
    expect(md).toContain('translation: pending');
    expect(md).toContain('## Trinh sát');
    expect(md).toContain('![Trang đăng nhập](./images/vi-01-login-page.png)');
    // Ảnh external mặc định KHÔNG tải (lộ IP cho host lạ): chỉ ghi chú, không gửi request nào tới host đó.
    expect(md).toContain('[[ẢNH EXTERNAL KHÔNG TẢI: https://img.example/diagram.svg]]');
    expect(calls).not.toContain('https://img.example/diagram.svg');
    expect(out.results[0]?.externalSkipped).toEqual([
      { index: 2, url: 'https://img.example/diagram.svg' },
    ]);
    expect(md).toContain('> **[Callout ⚠️]** Không chạy trên hệ thống thật.');
    expect(md).toContain('[chưa hỗ trợ: toggle]');
    expect(readdirSync(join(dir, 'images'))).toEqual(['vi-01-login-page.png']);

    // Không chép URL S3 có chữ ký hay token vào file/báo cáo.
    expect(md).not.toMatch(/amazonaws|SIGNED-SECRET/);
    expect(out.report).not.toMatch(/amazonaws|SIGNED-SECRET/);
    expect(md).not.toContain(TOKEN);
    expect(out.report).not.toContain(TOKEN);

    // Không ghi gì ngoài _import/, không đụng bài đã xuất bản.
    expect(readdirSync(join(root, 'content/writeups')).sort()).toEqual([
      '_import',
      'published-room',
    ]);
    expect(readdirSync(join(root, 'content/writeups/published-room'))).toEqual(['vi.mdx']);
    expect(readFileSync(join(root, 'content/writeups/published-room/vi.mdx'), 'utf8')).toBe(
      'đã xuất bản',
    );

    const r = out.results[0];
    const kinds = r?.findings.map((f) => `${f.kind}:${f.line}`);
    expect(kinds).toEqual(expect.arrayContaining(['flag:20', 'ip:20', 'prompt:23', 'ip:23']));
    expect(out.report).toContain(
      'content/writeups/_import/sample-room/vi.md:20  [flag] THM{fake-test-flag}',
    );
    expect(out.report).toContain(
      'content/writeups/_import/sample-room/vi.md:23  [prompt] user1@home-pc',
    );
    expect(out.report).toContain(
      'content/writeups/_import/sample-room/images/vi-01-login-page.png  [metadata: tEXt]',
    );
    expect(out.results[1]?.otherWarnings.join()).toMatch(
      /đã xuất bản ở content\/writeups\/published-room\/vi\.mdx/,
    );

    expect(out.skipped.map((s) => s.reason)).toEqual([
      expect.stringMatching(/slug "Bad Slug!" không hợp lệ/),
      expect.stringMatching(/sample-room\/vi trùng/),
    ]);

    const last = out.report.trimEnd().split('\n').at(-1) ?? '';
    expect(last).toMatch(
      /^TỔNG KẾT: kéo về 2 bài \(bỏ qua 2\) · flag 1 · IP 2 · prompt 1 · đường dẫn home 0 · ảnh có metadata 1 · ảnh lỗi 0 · ảnh external không tải 1/,
    );
    expect(last.endsWith(REMINDER)).toBe(true);
  });

  it('không ghi đè _import/<slug>/ đã có trừ khi --force', async () => {
    const dir = join(root, 'content/writeups/_import/sample-room');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'vi.md'), 'đang soát dở');

    const first = await run();
    expect(readFileSync(join(dir, 'vi.md'), 'utf8')).toBe('đang soát dở');
    expect(first.skipped.some((s) => /đã có .*--force/.test(s.reason))).toBe(true);

    await mkdir(join(dir, 'images'));
    await writeFile(join(dir, 'images', 'vi-09-stale.png'), 'cũ');
    await writeFile(join(dir, 'ghi-chu.txt'), 'của tác giả');
    const forced = await run(true);
    expect(forced.results.map((r) => r.slug)).toContain('sample-room');
    expect(readFileSync(join(dir, 'vi.md'), 'utf8')).toMatch(/^---\n/);
    // --force chỉ thay file của bản được kéo (vi.md + images/vi-*), giữ file khác.
    expect(existsSync(join(dir, 'images', 'vi-09-stale.png'))).toBe(false);
    expect(readFileSync(join(dir, 'ghi-chu.txt'), 'utf8')).toBe('của tác giả');
  });

  it('--force nhưng lỗi API khi lấy nội dung → giữ nguyên bản nháp cũ, đánh dấu failed', async () => {
    const dir = join(root, 'content/writeups/_import/sample-room');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'vi.md'), 'đang soát dở');
    const failing: FetchFn = async (url, init) =>
      url.startsWith(`${API_BASE}/blocks/${PAGE_OK}`)
        ? json({ code: 'object_not_found', message: 'x' }, 404)
        : fakeNotion(url, init);

    const out = await pull({ token: TOKEN, databaseId: DB, force: true, root, fetch: failing });
    expect(out.failed).toBe(true);
    expect(readFileSync(join(dir, 'vi.md'), 'utf8')).toBe('đang soát dở');
    expect(out.skipped.some((s) => /404 object_not_found/.test(s.reason))).toBe(true);
  });
});

describe('--external-images', () => {
  it('bật thì mới tải ảnh external (vẫn qua mọi kiểm tra: SVG bị từ chối)', async () => {
    const out = await pull({
      token: TOKEN,
      databaseId: DB,
      force: false,
      externalImages: true,
      root,
      fetch: fakeNotion,
    });
    const md = readFileSync(join(root, 'content/writeups/_import/sample-room/vi.md'), 'utf8');
    expect(calls).toContain('https://img.example/diagram.svg');
    expect(md).toContain('[[ẢNH CHƯA TẢI: 02 — SVG bị từ chối');
    expect(out.results[0]?.externalSkipped).toEqual([]);
  });
});

describe('ghi nguyên tử (review M4 L5)', () => {
  it('--force: luồng ảnh lỗi giữa chừng không làm dừng run, bài mới vẫn ghi đủ, không còn thư mục tạm', async () => {
    const dir = join(root, 'content/writeups/_import/sample-room');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'vi.md'), 'đang soát dở');
    const broken: FetchFn = async (url, init) => {
      if (url.startsWith('https://prod-files-secure.s3.us-west-2.amazonaws.com/')) {
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(png());
            c.error(new Error('timeout giữa luồng'));
          },
        });
        return response(stream);
      }
      return fakeNotion(url, init);
    };
    const out = await pull({ token: TOKEN, databaseId: DB, force: true, root, fetch: broken });
    const r = out.results.find((x) => x.slug === 'sample-room');
    expect(r?.imageFailures.map((f) => f.reason)).toEqual(
      expect.arrayContaining([expect.stringMatching(/lỗi khi tải/)]),
    );
    expect(readFileSync(join(dir, 'vi.md'), 'utf8')).toMatch(/\[\[ẢNH CHƯA TẢI: 01 — lỗi khi tải/);
    expect(
      readdirSync(join(root, 'content/writeups/_import')).filter((n) => n.startsWith('.tmp-')),
    ).toEqual([]);
  });
});

describe('song ngữ: key (Slug, Version)', () => {
  const PAGE_VI = id(0xb1);
  const PAGE_EN = id(0xb2);
  const PAGE_X = id(0xb3);
  const version = (name: string | null) => ({
    Version: { type: 'select', select: name === null ? null : { name } },
  });

  /** Notion giả với một trang kết quả; mọi trang có cùng nội dung mẫu (1 ảnh S3, 1 ảnh external). */
  const notionWith =
    (pages: { id: string; properties: Record<string, unknown> }[]): FetchFn =>
    async (url, init) => {
      calls.push(url);
      if (url === `${API_BASE}/databases/${DB}`)
        return json({ properties: { Status: { type: 'status' } } });
      if (url === `${API_BASE}/databases/${DB}/query`)
        return json({ results: pages, has_more: false });
      if (pages.some((pg) => url.startsWith(`${API_BASE}/blocks/${pg.id}/children`)))
        return json(pageBlocks);
      return fakeNotion(url, init);
    };

  const bilingual = [
    { id: PAGE_VI, properties: properties(version('VI')) },
    {
      id: PAGE_EN,
      properties: properties({
        ...version('EN'),
        Title: { type: 'title', title: [rt('Sample room: SQLi to RCE')] },
      }),
    },
  ];
  const pullWith = (pages: typeof bilingual, force = false) =>
    pull({ token: TOKEN, databaseId: DB, force, root, fetch: notionWith(pages) });
  const dir = () => join(root, 'content/writeups/_import/sample-room');

  it('hai dòng cùng Slug, khác Version → vi.md + en.md, ảnh có tiền tố không đè nhau', async () => {
    const out = await pullWith(bilingual);
    expect(out.failed).toBe(false);
    expect(out.skipped).toEqual([]);
    expect(out.results.map((r) => `${r.slug}/${r.locale}`)).toEqual([
      'sample-room/vi',
      'sample-room/en',
    ]);
    const vi = readFileSync(join(dir(), 'vi.md'), 'utf8');
    const en = readFileSync(join(dir(), 'en.md'), 'utf8');
    expect(vi).toMatch(/^---\ntitle: "Phòng mẫu: SQLi tới RCE"\n/);
    expect(en).toMatch(/^---\ntitle: "Sample room: SQLi to RCE"\n/);
    for (const md of [vi, en]) {
      expect(md).toContain('draft: true');
      expect(md).toContain('translation: pending');
    }
    expect(vi).toContain('](./images/vi-01-login-page.png)');
    expect(en).toContain('](./images/en-01-login-page.png)');
    expect(readdirSync(join(dir(), 'images')).sort()).toEqual([
      'en-01-login-page.png',
      'vi-01-login-page.png',
    ]);
    expect(out.report).toContain('## sample-room/en — Sample room: SQLi to RCE');
    expect(out.report).toContain('content/writeups/_import/sample-room/en.md:20  [flag]');
    // Không ghi gì ra content/writeups ngoài _import/.
    expect(readdirSync(join(root, 'content/writeups')).sort()).toEqual([
      '_import',
      'published-room',
    ]);
  });

  it('một dòng Ready thiếu Version → DỪNG: không gọi block, không ghi file, báo tên + slug', async () => {
    const out = await pullWith([
      ...bilingual,
      {
        id: PAGE_X,
        properties: properties({
          ...version(null),
          Title: { type: 'title', title: [rt('Bài thiếu version')] },
          Slug: { type: 'rich_text', rich_text: [rt('thieu-version')] },
        }),
      },
    ]);
    expect(out.failed).toBe(true);
    expect(out.results).toEqual([]);
    expect(out.report).toContain('  - Bài thiếu version — slug "thieu-version"');
    expect(out.report).toMatch(/CHƯA ghi file nào/);
    expect(calls.filter((u) => u.includes('/blocks/'))).toEqual([]);
    expect(existsSync(join(root, 'content/writeups/_import'))).toBe(false);
  });

  it('Version lạ → bỏ qua kèm cảnh báo, dòng khác vẫn được kéo', async () => {
    const out = await pullWith([
      bilingual[0]!,
      { id: PAGE_X, properties: properties({ ...version('English') }) },
    ]);
    expect(out.failed).toBe(false);
    expect(out.results.map((r) => r.locale)).toEqual(['vi']);
    expect(out.skipped.map((x) => x.reason)).toEqual(['Version "English" không thuộc EN|VI']);
    expect(existsSync(join(dir(), 'en.md'))).toBe(false);
    expect(calls.filter((u) => u.startsWith(`${API_BASE}/blocks/${PAGE_X}`))).toEqual([]);
  });

  it('đã có vi.md đang soát → giữ nguyên, vẫn kéo en.md; --force cho en không đụng bản vi', async () => {
    await mkdir(join(dir(), 'images'), { recursive: true });
    await writeFile(join(dir(), 'vi.md'), 'vi đang soát dở');
    await writeFile(join(dir(), 'images', 'vi-01-login-page.png'), 'ảnh vi đã che');

    const first = await pullWith(bilingual);
    expect(first.results.map((r) => r.locale)).toEqual(['en']);
    expect(first.skipped.map((x) => x.reason)).toEqual([
      expect.stringMatching(/_import\/sample-room\/vi\.md đã có .*--force/),
    ]);
    expect(readFileSync(join(dir(), 'vi.md'), 'utf8')).toBe('vi đang soát dở');
    expect(existsSync(join(dir(), 'en.md'))).toBe(true);

    await writeFile(join(dir(), 'en.md'), 'en đang soát dở');
    const forced = await pullWith([bilingual[1]!], true);
    expect(forced.results.map((r) => r.locale)).toEqual(['en']);
    expect(readFileSync(join(dir(), 'en.md'), 'utf8')).toMatch(/^---\n/);
    expect(readFileSync(join(dir(), 'vi.md'), 'utf8')).toBe('vi đang soát dở');
    expect(readFileSync(join(dir(), 'images', 'vi-01-login-page.png'), 'utf8')).toBe(
      'ảnh vi đã che',
    );
    expect(
      readdirSync(join(root, 'content/writeups/_import')).filter((n) => n.startsWith('.')),
    ).toEqual([]);
  });

  it('--force bản vi: thay ảnh nháp cũ (mẫu tên pull), GIỮ ảnh tác giả thêm tay', async () => {
    await mkdir(join(dir(), 'images'), { recursive: true });
    await writeFile(join(dir(), 'vi.md'), 'vi cũ');
    await writeFile(join(dir(), 'images', '01-login-page.png'), 'ảnh pull cũ');
    await writeFile(join(dir(), 'images', 'cover-da-che.png'), 'ảnh tác giả tự che');
    const out = await pullWith([bilingual[0]!], true);
    expect(out.failed).toBe(false);
    expect(existsSync(join(dir(), 'images', '01-login-page.png'))).toBe(false);
    expect(readFileSync(join(dir(), 'images', 'cover-da-che.png'), 'utf8')).toBe(
      'ảnh tác giả tự che',
    );
    expect(existsSync(join(dir(), 'images', 'vi-01-login-page.png'))).toBe(true);
  });

  it('hai dòng cùng (Slug, Version) → dòng sau bị bỏ qua vì trùng', async () => {
    const out = await pullWith([bilingual[0]!, { ...bilingual[0]!, id: PAGE_X }]);
    expect(out.results).toHaveLength(1);
    expect(out.skipped.map((x) => x.reason)).toEqual([
      expect.stringMatching(/sample-room\/vi trùng/),
    ]);
  });
});

describe('writeFailure (review M2)', () => {
  const rel = (p: string) => p.replace('/r/', '');
  it('rollback không trọn → nói rõ, chỉ chỗ backup, KHÔNG nói "giữ nguyên"', () => {
    const err = new RollbackError(
      '/r/content/writeups/_import/.tmp-x-old-1',
      ['vi.md'],
      new Error('x'),
    );
    const msg = writeFailure(err, '/r/content/writeups/_import/x', rel);
    expect(msg).toMatch(/KHÔI PHỤC CHƯA TRỌN/);
    expect(msg).toContain('content/writeups/_import/.tmp-x-old-1/ (vi.md)');
    expect(msg).not.toMatch(/giữ nguyên/);
  });
  it('lỗi thường → bản nháp cũ giữ nguyên', () => {
    expect(writeFailure(new TypeError('x'), '/r/d', rel)).toMatch(/TypeError.*giữ nguyên/);
  });
});

describe('readEnv', () => {
  it('báo tên biến còn thiếu', () => {
    expect(readEnv({}).missing).toEqual(['NOTION_TOKEN', 'NOTION_DATABASE_ID']);
    expect(readEnv({ NOTION_TOKEN: ' ', NOTION_DATABASE_ID: DB }).missing).toEqual([
      'NOTION_TOKEN',
    ]);
    expect(readEnv({ NOTION_TOKEN: TOKEN, NOTION_DATABASE_ID: DB })).toEqual({
      token: TOKEN,
      databaseId: DB,
      missing: [],
    });
  });
});
