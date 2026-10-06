import type { Block, BlockNode, FetchFn, Page } from './types.ts';

/**
 * Client Notion API tối thiểu bằng `fetch` (0 dependency, ADR 0013). Chỉ ĐỌC: lấy schema
 * database, query bài theo Status, lấy block con. Ghim Notion-Version 2022-06-28 để dùng
 * `POST /databases/{id}/query` (bản 2025-09-03 chuyển sang `data_sources`).
 */
export const NOTION_VERSION = '2022-06-28';
export const API_BASE = 'https://api.notion.com/v1';
export const MAX_DEPTH = 8;
const PAGE_SIZE = 100;
const TIMEOUT_MS = 30_000;
const MAX_RETRY_AFTER_S = 60;

/** ID Notion: 32 hex, có hoặc không có gạch nối. Trả dạng 32 hex, sai thì `null`. */
export function normalizeId(id: string): string | null {
  const compact = id.trim().replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(compact) ? compact : null;
}

export class NotionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'NotionError';
    this.status = status;
    this.code = code;
  }
}

export interface ClientOptions {
  token: string;
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

export interface NotionClient {
  /** Bài có cột `statusProperty` = `value`, đủ mọi trang kết quả. */
  queryByStatus(databaseId: string, statusProperty: string, value: string): Promise<Page[]>;
  /** Cây block con của một trang/block, đủ mọi trang kết quả, đệ quy tới `MAX_DEPTH`. */
  fetchBlockTree(blockId: string): Promise<BlockNode[]>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Không bao giờ để token lọt vào thông báo lỗi, kể cả khi server lặp lại nó. */
function redact(text: string, token: string): string {
  return token ? text.split(token).join('[REDACTED]') : text;
}

export function createClient(options: ClientOptions): NotionClient {
  const { token } = options;
  const doFetch: FetchFn = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? defaultSleep;
  const maxRetries = options.maxRetries ?? 3;

  async function request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await doFetch(`${API_BASE}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        if (attempt < maxRetries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        const reason = err instanceof Error ? err.name : 'lỗi không rõ';
        throw new NotionError(
          0,
          'network',
          `không kết nối được api.notion.com (${reason}); tường lửa đã mở chưa? (docs/workflow.md)`,
        );
      }

      if (res.ok) return res.json();

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < maxRetries) {
        const header = Number(res.headers.get('retry-after'));
        const waitS =
          Number.isFinite(header) && header > 0
            ? Math.min(header, MAX_RETRY_AFTER_S)
            : 2 ** attempt;
        await res.body?.cancel();
        await sleep(waitS * 1000);
        continue;
      }

      let code = 'unknown';
      let message = res.statusText;
      try {
        const data = (await res.json()) as { code?: unknown; message?: unknown };
        if (typeof data.code === 'string') code = data.code;
        if (typeof data.message === 'string') message = data.message;
      } catch {
        // Thân lỗi không phải JSON: giữ statusText.
      }
      throw new NotionError(
        res.status,
        code,
        redact(`Notion API ${res.status} ${code}: ${message}`.slice(0, 500), token),
      );
    }
  }

  async function databaseStatusType(databaseId: string, property: string): Promise<string> {
    const db = (await request('GET', `/databases/${databaseId}`)) as { properties?: unknown };
    const props = db.properties as Record<string, { type?: unknown }> | undefined;
    const type = props?.[property]?.type;
    if (type !== 'status' && type !== 'select') {
      throw new NotionError(
        0,
        'schema',
        `database không có cột "${property}" kiểu status/select (đọc được: ${String(type)})`,
      );
    }
    return type;
  }

  async function queryByStatus(
    databaseId: string,
    statusProperty: string,
    value: string,
  ): Promise<Page[]> {
    const id = normalizeId(databaseId);
    if (!id)
      throw new NotionError(
        0,
        'config',
        'NOTION_DATABASE_ID không phải ID Notion hợp lệ (32 ký tự hex)',
      );
    const type = await databaseStatusType(id, statusProperty);
    const pages: Page[] = [];
    let cursor: string | undefined;
    do {
      const data = (await request('POST', `/databases/${id}/query`, {
        filter: { property: statusProperty, [type]: { equals: value } },
        page_size: PAGE_SIZE,
        ...(cursor ? { start_cursor: cursor } : {}),
      })) as { results?: unknown; has_more?: unknown; next_cursor?: unknown };
      for (const r of Array.isArray(data.results) ? data.results : []) {
        const page = r as Partial<Page>;
        if (typeof page.id === 'string' && page.properties && typeof page.properties === 'object') {
          pages.push({ id: page.id, properties: page.properties });
        }
      }
      cursor =
        data.has_more === true && typeof data.next_cursor === 'string'
          ? data.next_cursor
          : undefined;
    } while (cursor);
    return pages;
  }

  async function listChildren(blockId: string): Promise<Block[]> {
    const id = normalizeId(blockId);
    if (!id) throw new NotionError(0, 'data', 'block id không hợp lệ trong dữ liệu Notion');
    const blocks: Block[] = [];
    let cursor: string | undefined;
    do {
      const qs = new URLSearchParams({ page_size: String(PAGE_SIZE) });
      if (cursor) qs.set('start_cursor', cursor);
      const data = (await request('GET', `/blocks/${id}/children?${qs}`)) as {
        results?: unknown;
        has_more?: unknown;
        next_cursor?: unknown;
      };
      for (const r of Array.isArray(data.results) ? data.results : []) {
        const b = r as Partial<Block>;
        if (typeof b.id === 'string' && typeof b.type === 'string') blocks.push(b as Block);
      }
      cursor =
        data.has_more === true && typeof data.next_cursor === 'string'
          ? data.next_cursor
          : undefined;
    } while (cursor);
    return blocks;
  }

  /** Không đi vào trang/database con: đó là nội dung khác, không thuộc bài. */
  const NO_DESCEND = new Set(['child_page', 'child_database']);

  async function fetchBlockTree(blockId: string, depth = 0): Promise<BlockNode[]> {
    const blocks: BlockNode[] = await listChildren(blockId);
    for (const b of blocks) {
      if (!b.has_children || NO_DESCEND.has(b.type)) continue;
      if (depth + 1 >= MAX_DEPTH) b.truncated = true;
      else b.children = await fetchBlockTree(b.id, depth + 1);
    }
    return blocks;
  }

  return { queryByStatus, fetchBlockTree: (id) => fetchBlockTree(id) };
}
