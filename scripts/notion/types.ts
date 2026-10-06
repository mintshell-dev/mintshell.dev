/**
 * Kiểu tối thiểu cho phần Notion API mà `notion:pull` dùng (Notion-Version 2022-06-28).
 * Dữ liệu từ Notion là dữ liệu ngoài, không tin cậy: mọi chỗ đọc đều kiểm tra kiểu khi chạy,
 * các kiểu ở đây chỉ mô tả hình dạng mong đợi.
 */

export interface RichText {
  type?: string;
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
}

export interface Block {
  id: string;
  type: string;
  has_children?: boolean;
  [payload: string]: unknown;
}

/** Block kèm block con đã tải (đệ quy). `truncated`: còn con nhưng vượt giới hạn độ sâu. */
export interface BlockNode extends Block {
  children?: BlockNode[];
  truncated?: boolean;
}

export interface Page {
  id: string;
  properties: Record<string, unknown>;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Lấy mảng rich text từ giá trị không rõ kiểu; sai kiểu thì trả mảng rỗng. */
export function richTexts(value: unknown): RichText[] {
  return Array.isArray(value)
    ? value.filter((t): t is RichText => !!t && typeof t === 'object')
    : [];
}

/** Ghép `plain_text` của một mảng rich text. */
export function plainText(value: unknown): string {
  return richTexts(value)
    .map((t) => (typeof t.plain_text === 'string' ? t.plain_text : ''))
    .join('');
}

/** Payload của block (`block[block.type]`) dưới dạng object, hoặc object rỗng. */
export function payloadOf(block: Block): Record<string, unknown> {
  const p = block[block.type];
  return p && typeof p === 'object' ? (p as Record<string, unknown>) : {};
}
