import { describe, expect, it } from 'vitest';

import {
  API_BASE,
  createClient,
  MAX_DEPTH,
  normalizeId,
  NOTION_VERSION,
  NotionError,
} from './api.ts';
import { id, json } from './test-helpers.ts';
import type { FetchFn } from './types.ts';

const TOKEN = 'ntn_FAKE_TEST_TOKEN_0000';
const DB = id(0xdb);

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** Fetch giả: trả lần lượt từng response trong hàng đợi, ghi lại mọi lời gọi. */
function queue(...responses: (Response | Error)[]): { fetch: FetchFn; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error('hết response giả');
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const noSleep = async () => {};
const statusDb = (type = 'status') => json({ properties: { Status: { type } } });
const page = (n: number) => ({ id: id(n), properties: { Title: {} } });

describe('normalizeId', () => {
  it('chấp nhận 32 hex có/không gạch nối; từ chối còn lại', () => {
    expect(normalizeId('0123456789ABCDEF0123456789abcdef')).toBe(
      '0123456789abcdef0123456789abcdef',
    );
    expect(normalizeId('01234567-89ab-cdef-0123-456789abcdef')).toBe(
      '0123456789abcdef0123456789abcdef',
    );
    expect(normalizeId('../../users')).toBeNull();
    expect(normalizeId('https://notion.so/x')).toBeNull();
  });
});

describe('queryByStatus', () => {
  it('lọc Status = Ready theo đúng kiểu cột, đủ header, phân trang tới hết', async () => {
    const { fetch, calls } = queue(
      statusDb('status'),
      json({ results: [page(1), page(2)], has_more: true, next_cursor: 'c1' }),
      json({ results: [page(3)], has_more: false, next_cursor: null }),
    );
    const pages = await createClient({ token: TOKEN, fetch, sleep: noSleep }).queryByStatus(
      DB,
      'Status',
      'Ready',
    );

    expect(pages.map((p) => p.id)).toEqual([id(1), id(2), id(3)]);
    expect(calls[0]?.url).toBe(`${API_BASE}/databases/${DB}`);
    expect(calls[1]?.url).toBe(`${API_BASE}/databases/${DB}/query`);
    const body1 = JSON.parse(String(calls[1]?.init?.body));
    const body2 = JSON.parse(String(calls[2]?.init?.body));
    expect(body1).toEqual({
      filter: { property: 'Status', status: { equals: 'Ready' } },
      page_size: 100,
    });
    expect(body2.start_cursor).toBe('c1');
    const headers = calls[1]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers['Notion-Version']).toBe(NOTION_VERSION);
    expect(calls.every((c) => c.init?.method === 'GET' || c.init?.method === 'POST')).toBe(true);
  });

  it('cột Status kiểu select → filter select', async () => {
    const { fetch, calls } = queue(statusDb('select'), json({ results: [], has_more: false }));
    await createClient({ token: TOKEN, fetch }).queryByStatus(DB, 'Status', 'Ready');
    expect(JSON.parse(String(calls[1]?.init?.body)).filter).toEqual({
      property: 'Status',
      select: { equals: 'Ready' },
    });
  });

  it('database id sai → lỗi cấu hình, không gọi mạng', async () => {
    const { fetch, calls } = queue();
    await expect(
      createClient({ token: TOKEN, fetch }).queryByStatus('xyz', 'Status', 'Ready'),
    ).rejects.toThrow(/NOTION_DATABASE_ID/);
    expect(calls).toHaveLength(0);
  });

  it('thiếu cột Status → lỗi rõ ràng', async () => {
    const { fetch } = queue(json({ properties: {} }));
    await expect(
      createClient({ token: TOKEN, fetch }).queryByStatus(DB, 'Status', 'Ready'),
    ).rejects.toThrow(/không có cột "Status"/);
  });
});

describe('retry và lỗi', () => {
  it('429 → chờ đúng Retry-After rồi thử lại', async () => {
    const waits: number[] = [];
    const { fetch } = queue(
      json({ code: 'rate_limited' }, 429, { 'retry-after': '2' }),
      statusDb(),
      json({ results: [page(1)], has_more: false }),
    );
    const sleep = async (ms: number) => {
      waits.push(ms);
    };
    const pages = await createClient({ token: TOKEN, fetch, sleep }).queryByStatus(
      DB,
      'Status',
      'Ready',
    );
    expect(pages).toHaveLength(1);
    expect(waits).toEqual([2000]);
  });

  it('5xx quá số lần retry → NotionError', async () => {
    const { fetch, calls } = queue(
      ...Array.from({ length: 4 }, () => json({ code: 'internal' }, 503)),
    );
    const err = await createClient({ token: TOKEN, fetch, sleep: noSleep })
      .queryByStatus(DB, 'Status', 'Ready')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotionError);
    expect((err as NotionError).status).toBe(503);
    expect(calls).toHaveLength(4);
  });

  it('lỗi 401 không làm lộ token, kể cả khi server lặp lại token trong message', async () => {
    const { fetch } = queue(
      json({ code: 'unauthorized', message: `API token ${TOKEN} is invalid.` }, 401),
    );
    const err = (await createClient({ token: TOKEN, fetch })
      .queryByStatus(DB, 'Status', 'Ready')
      .catch((e: unknown) => e)) as NotionError;
    expect(err.message).toContain('401 unauthorized');
    expect(err.message).not.toContain(TOKEN);
    expect(String(err.stack)).not.toContain(TOKEN);
  });

  it('lỗi mạng (tường lửa) → thông báo gợi ý, không lộ token', async () => {
    const boom = new TypeError(`fetch failed for ${TOKEN}`);
    const { fetch } = queue(boom, boom, boom, boom);
    const err = (await createClient({ token: TOKEN, fetch, sleep: noSleep })
      .queryByStatus(DB, 'Status', 'Ready')
      .catch((e: unknown) => e)) as NotionError;
    expect(err.message).toMatch(/tường lửa/);
    expect(err.message).not.toContain(TOKEN);
  });
});

describe('fetchBlockTree', () => {
  it('phân trang block con và đệ quy vào block có con', async () => {
    const parent = id(0x100);
    const child = { id: id(0x101), type: 'bulleted_list_item', has_children: true };
    const { fetch, calls } = queue(
      json({ results: [{ id: id(0x102), type: 'paragraph' }], has_more: true, next_cursor: 'n1' }),
      json({ results: [child], has_more: false }),
      json({ results: [{ id: id(0x103), type: 'paragraph' }], has_more: false }),
    );
    const tree = await createClient({ token: TOKEN, fetch }).fetchBlockTree(parent);
    expect(tree.map((b) => b.id)).toEqual([id(0x102), id(0x101)]);
    expect(tree[1]?.children?.map((b) => b.id)).toEqual([id(0x103)]);
    expect(calls[0]?.url).toBe(`${API_BASE}/blocks/${parent}/children?page_size=100`);
    expect(calls[1]?.url).toBe(
      `${API_BASE}/blocks/${parent}/children?page_size=100&start_cursor=n1`,
    );
  });

  it('không đi vào trang con; dừng ở MAX_DEPTH và đánh dấu truncated', async () => {
    let n = 0x200;
    const fetch: FetchFn = async (url) => {
      if (url.includes(id(0x1ff)))
        return json({
          results: [
            { id: id(0x1fe), type: 'child_page', has_children: true },
            { id: id(++n), type: 'quote', has_children: true },
          ],
          has_more: false,
        });
      return json({
        results: [{ id: id(++n), type: 'quote', has_children: true }],
        has_more: false,
      });
    };
    const tree = await createClient({ token: TOKEN, fetch }).fetchBlockTree(id(0x1ff));
    expect(tree[0]?.children).toBeUndefined();
    let depth = 1;
    let node = tree[1];
    while (node?.children) {
      node = node.children[0];
      depth++;
    }
    expect(depth).toBe(MAX_DEPTH);
    expect(node?.truncated).toBe(true);
  });
});
