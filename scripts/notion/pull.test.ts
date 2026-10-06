import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pull, readEnv } from '../notion-pull.ts';
import { API_BASE } from './api.ts';
import pageBlocks from './fixtures/page-blocks.json' with { type: 'json' };
import { REMINDER } from './report.ts';
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
    expect(md).toContain('![Trang đăng nhập](./images/01-login-page.png)');
    // Ảnh external mặc định KHÔNG tải (lộ IP cho host lạ): chỉ ghi chú, không gửi request nào tới host đó.
    expect(md).toContain('[[ẢNH EXTERNAL KHÔNG TẢI: https://img.example/diagram.svg]]');
    expect(calls).not.toContain('https://img.example/diagram.svg');
    expect(out.results[0]?.externalSkipped).toEqual([
      { index: 2, url: 'https://img.example/diagram.svg' },
    ]);
    expect(md).toContain('> **[Callout ⚠️]** Không chạy trên hệ thống thật.');
    expect(md).toContain('[chưa hỗ trợ: toggle]');
    expect(readdirSync(join(dir, 'images'))).toEqual(['01-login-page.png']);

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
    expect(readdirSync(join(root, 'content/writeups/published-room'))).toEqual([]);

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
      'content/writeups/_import/sample-room/images/01-login-page.png  [metadata: tEXt]',
    );
    expect(out.results[1]?.otherWarnings.join()).toMatch(/slug đã xuất bản/);

    expect(out.skipped.map((s) => s.reason)).toEqual([
      expect.stringMatching(/slug "Bad Slug!" không hợp lệ/),
      expect.stringMatching(/slug "sample-room" trùng/),
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

    await writeFile(join(dir, 'stale.png'), 'cũ');
    const forced = await run(true);
    expect(forced.results.map((r) => r.slug)).toContain('sample-room');
    expect(readFileSync(join(dir, 'vi.md'), 'utf8')).toMatch(/^---\n/);
    expect(existsSync(join(dir, 'stale.png'))).toBe(false);
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
