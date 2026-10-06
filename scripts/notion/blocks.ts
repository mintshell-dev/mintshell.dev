import { type BlockNode, payloadOf, plainText, type RichText, richTexts } from './types.ts';

/**
 * Cây block Notion → Markdown nháp (hàm thuần). Ảnh chỉ để chỗ (`notion-image:NN`), thay bằng
 * đường dẫn file thật sau khi tải (`applyImages`). Block lạ ghi `[chưa hỗ trợ: <type>]`.
 *
 * Khi tác giả đổi sang `.mdx`, MDX biến chữ thành mã ở ba chỗ: `{…}`, `<…>` và dòng bắt đầu bằng
 * `import`/`export` (ESM, chạy lúc build). Chữ thường được escape (gồm `{ } <`) và dòng ESM được vô hiệu
 * hóa bằng character reference (`neutralizeEsm`) — ADR 0013. Nội dung code giữ nguyên.
 */

export interface ImageRef {
  /** Số thứ tự từ 1, theo thứ tự xuất hiện. */
  index: number;
  url: string;
  /** `file`: Notion lưu (URL S3 có chữ ký, hết hạn nhanh, không được chép ra); `external`: link ngoài. */
  source: 'file' | 'external';
  /** Caption trong Notion; rỗng thì `null`. */
  alt: string | null;
}

export interface RenderResult {
  markdown: string;
  images: ImageRef[];
  /** Loại block chưa hỗ trợ, theo thứ tự gặp. */
  unsupported: string[];
  /** Cảnh báo khác: link (scheme lạ, nội bộ Notion, URL S3 có chữ ký), mention người dùng, dòng ESM. */
  warnings: string[];
}

export const MISSING_ALT = '[[THIẾU ALT]]';

interface Ctx {
  images: ImageRef[];
  unsupported: string[];
  warnings: string[];
}

const MD_SPECIAL = /[\\`*_[\]{}<~]/g;

export function escapeText(text: string): string {
  return text.replace(MD_SPECIAL, (c) => `\\${c}`);
}

function inlineCode(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** Đặt dấu định dạng bên trong khoảng trắng đầu/cuối (`** a **` không còn là chữ đậm). */
function wrap(text: string, marker: string): string {
  const m = /^(\s*)(.*?)(\s*)$/s.exec(text);
  if (!m || !m[2]) return text;
  return `${m[1]}${marker}${m[2]}${marker}${m[3]}`;
}

/** `encodeURIComponent` không mã hóa `(` `)`, mà chúng làm hỏng cú pháp link Markdown. */
const URL_ESCAPES: Record<string, string> = {
  '(': '%28',
  ')': '%29',
  '<': '%3C',
  '>': '%3E',
  ' ': '%20',
};

function safeHref(href: string, ctx: Ctx): string | null {
  let url: URL;
  try {
    url = new URL(href, 'https://www.notion.so');
  } catch {
    ctx.warnings.push(`link không hợp lệ bị bỏ: ${href.slice(0, 80)}`);
    return null;
  }
  if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) {
    ctx.warnings.push(`link scheme lạ bị bỏ (chỉ giữ chữ): ${href.slice(0, 80)}`);
    return null;
  }
  if (/(^|\.)amazonaws\.com$/.test(url.hostname) || /x-amz-signature/i.test(url.search)) {
    // Link tới file đính kèm Notion: URL S3 có chữ ký, không được chép ra file.
    ctx.warnings.push(
      `link tới file Notion (URL S3 có chữ ký) bị bỏ, chỉ giữ chữ: ${url.hostname}`,
    );
    return null;
  }
  if (/(^|\.)notion\.(so|site)$/.test(url.hostname)) {
    ctx.warnings.push(
      `link nội bộ Notion (đổi hoặc bỏ trước khi xuất bản): ${url.href.slice(0, 80)}`,
    );
  }
  return url.href.replace(/[()<> ]/g, (c) => URL_ESCAPES[c] ?? c);
}

function renderRich(value: unknown, ctx: Ctx): string {
  return richTexts(value)
    .map((t: RichText) => {
      const raw = typeof t.plain_text === 'string' ? t.plain_text : '';
      if (!raw) return '';
      const mention = (t as { mention?: { type?: unknown } }).mention;
      if (t.type === 'mention' && mention?.type === 'user') {
        ctx.warnings.push(`mention người dùng Notion (có thể là tên thật): ${raw.slice(0, 60)}`);
      }
      const a = t.annotations ?? {};
      let s = a.code ? inlineCode(raw) : escapeText(raw);
      if (a.strikethrough) s = wrap(s, '~~');
      if (a.italic) s = wrap(s, '*');
      if (a.bold) s = wrap(s, '**');
      if (typeof t.href === 'string' && t.href) {
        const href = safeHref(t.href, ctx);
        if (href) s = `[${s}](${href})`;
      }
      return s;
    })
    .join('')
    .replace(/\n/g, '\\\n');
}

/** Văn bản thuần một dòng (cho alt, ô bảng): escape, xuống dòng thành khoảng trắng. */
function renderInline(value: unknown, ctx: Ctx): string {
  return renderRich(value, ctx).replace(/\\\n/g, ' ');
}

function prefixLines(text: string, prefix: string, firstPrefix = prefix): string {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? firstPrefix : prefix) + line)
    .join('\n')
    .replace(/[ \t]+$/gm, '');
}

const LANGUAGES: Record<string, string> = {
  'plain text': 'text',
  shell: 'bash',
  'c++': 'cpp',
  'c#': 'csharp',
  'f#': 'fsharp',
  'objective-c': 'objectivec',
  'visual basic': 'vbnet',
  'java/c/c++/c#': 'clike',
};

export function codeLanguage(notionLang: unknown): string {
  if (typeof notionLang !== 'string' || !notionLang) return 'text';
  const key = notionLang.toLowerCase().trim();
  return LANGUAGES[key] ?? key.replace(/[^a-z0-9+#-]+/g, '-');
}

const LIST_TYPES = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do']);

function renderChildren(block: BlockNode, ctx: Ctx): string {
  if (block.truncated) {
    ctx.unsupported.push('lồng quá sâu');
    return '[chưa hỗ trợ: lồng quá sâu]';
  }
  return block.children?.length ? renderBlocks(block.children, ctx) : '';
}

function renderTable(block: BlockNode, ctx: Ctx): string {
  const p = payloadOf(block);
  const rows = (block.children ?? []).filter((r) => r.type === 'table_row');
  const cells = rows.map((r) => {
    const raw = payloadOf(r).cells;
    return (Array.isArray(raw) ? raw : []).map((c) => renderInline(c, ctx).replace(/\|/g, '\\|'));
  });
  const width = Math.max(1, ...cells.map((r) => r.length));
  const line = (r: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
  const sep = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  const hasHeader = p.has_column_header === true && cells.length > 0;
  const header = hasHeader ? (cells[0] ?? []) : Array.from({ length: width }, () => '');
  const body = hasHeader ? cells.slice(1) : cells;
  return [line(header), sep, ...body.map(line)].join('\n');
}

function renderImage(block: BlockNode, ctx: Ctx): string {
  const p = payloadOf(block);
  const source = p.type === 'external' ? 'external' : 'file';
  const holder = p[source] as { url?: unknown } | undefined;
  const url = typeof holder?.url === 'string' ? holder.url : '';
  const alt = plainText(p.caption).replace(/\s+/g, ' ').trim();
  const index = ctx.images.length + 1;
  ctx.images.push({ index, url, source, alt: alt || null });
  const altText = alt ? renderInline(p.caption, ctx) : MISSING_ALT;
  return `![${altText}](notion-image:${String(index).padStart(2, '0')})`;
}

function renderBlock(block: BlockNode, ctx: Ctx): string {
  const p = payloadOf(block);
  const text = () => renderRich(p.rich_text, ctx);
  const children = () => renderChildren(block, ctx);
  const withChildren = (head: string) => [head, children()].filter(Boolean).join('\n\n');

  switch (block.type) {
    case 'paragraph':
      return withChildren(text());
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const level = Number(block.type.slice(-1)) + 1;
      return withChildren(`${'#'.repeat(level)} ${text()}`);
    }
    case 'quote': {
      const body = withChildren(text());
      return prefixLines(body, '> ');
    }
    case 'callout': {
      const icon = p.icon as { type?: unknown; emoji?: unknown } | undefined;
      const emoji =
        icon?.type === 'emoji' && typeof icon.emoji === 'string'
          ? ` ${escapeText(icon.emoji)}`
          : '';
      const body = withChildren(`**[Callout${emoji}]** ${text()}`);
      return prefixLines(body, '> ');
    }
    case 'code': {
      const code = plainText(p.rich_text);
      const longest = Math.max(0, ...[...code.matchAll(/`+/g)].map((m) => m[0].length));
      const fence = '`'.repeat(Math.max(3, longest + 1));
      const caption = renderInline(p.caption, ctx);
      const out = `${fence}${codeLanguage(p.language)}\n${code}\n${fence}`;
      return caption ? `${out}\n\n*${caption}*` : out;
    }
    case 'image':
      return renderImage(block, ctx);
    case 'table':
      return renderTable(block, ctx);
    case 'divider':
      return '---';
    default: {
      ctx.unsupported.push(block.type);
      return withChildren(`[chưa hỗ trợ: ${escapeText(block.type)}]`);
    }
  }
}

function renderListItem(block: BlockNode, number: number, ctx: Ctx): string {
  const p = payloadOf(block);
  const marker =
    block.type === 'numbered_list_item'
      ? `${number}. `
      : block.type === 'to_do'
        ? `- [${p.checked === true ? 'x' : ' '}] `
        : '- ';
  const indent = ' '.repeat(block.type === 'to_do' ? 2 : marker.length);
  const head = prefixLines(renderRich(p.rich_text, ctx), indent, marker);
  const kids = renderChildren(block, ctx);
  return kids ? `${head}\n\n${prefixLines(kids, indent)}` : head;
}

export function renderBlocks(blocks: BlockNode[], ctx: Ctx): string {
  const parts: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i] as BlockNode;
    if (LIST_TYPES.has(block.type)) {
      // Gom một dãy mục cùng loại thành một danh sách; số thứ tự đếm lại cho mỗi dãy.
      const items: string[] = [];
      let n = 1;
      while (i < blocks.length && (blocks[i] as BlockNode).type === block.type) {
        items.push(renderListItem(blocks[i] as BlockNode, n++, ctx));
        i++;
      }
      parts.push(items.join('\n'));
      continue;
    }
    const out = renderBlock(block, ctx);
    if (out) parts.push(out);
    i++;
  }
  return parts.join('\n\n');
}

const FENCE = /^[\s>]*(?:[-*+]\s+|\d+\.\s+)*(`{3,}|~{3,})/;
const ESM_LINE = /^([\s>]*(?:[-*+]\s+|\d+\.\s+)*)(import|export)(?=\s|$)/;

/**
 * Vô hiệu hóa dòng ESM của MDX: dòng (ngoài code) bắt đầu bằng `import`/`export` sẽ được MDX coi là
 * mã JS và CHẠY lúc build. Đổi chữ cái đầu thành character reference (`&#101;xport`): vẫn hiện đúng
 * chữ, không còn là ESM (đã thử trên Astro thật). Báo thừa cả trong trích dẫn/danh sách cho chắc.
 */
export function neutralizeEsm(markdown: string, warnings: string[]): string {
  let fence: string | null = null;
  return markdown
    .split('\n')
    .map((line) => {
      const f = FENCE.exec(line)?.[1];
      if (f) {
        if (fence === null) fence = f;
        else if (f[0] === fence[0] && f.length >= fence.length) fence = null;
        return line;
      }
      if (fence !== null) return line;
      const m = ESM_LINE.exec(line);
      if (!m) return line;
      const word = m[2] ?? '';
      warnings.push(
        `dòng bắt đầu bằng "${word}" (MDX sẽ chạy như mã JS), đã vô hiệu hóa — soát: ${line.trim().slice(0, 60)}`,
      );
      const ref = word === 'import' ? '&#105;' : '&#101;';
      return `${m[1]}${ref}${word.slice(1)}${line.slice(m[0].length)}`;
    })
    .join('\n');
}

export function renderPage(blocks: BlockNode[]): RenderResult {
  const ctx: Ctx = { images: [], unsupported: [], warnings: [] };
  const markdown = neutralizeEsm(renderBlocks(blocks, ctx), ctx.warnings);
  return { markdown: markdown ? `${markdown}\n` : '', ...ctx };
}

export type ImageOutcome = { path: string } | { failure: string } | { external: string };

/** Thay chỗ để ảnh bằng đường dẫn đã tải, ghi chú ảnh lỗi, hoặc ghi chú ảnh external không tải. */
export function applyImages(markdown: string, results: ReadonlyMap<number, ImageOutcome>): string {
  // Ảnh luôn đứng riêng một dòng; `.*?` (không qua dòng mới) chịu được alt có ngoặc lồng như [[THIẾU ALT]].
  return markdown.replace(/!\[(.*?)\]\(notion-image:(\d{2,})\)/g, (_m, alt, n) => {
    const r = results.get(Number(n));
    if (r && 'path' in r) return `![${alt}](${r.path})`;
    if (r && 'external' in r)
      return `[[ẢNH EXTERNAL KHÔNG TẢI: ${escapeText(r.external.slice(0, 200))}]]`;
    return `[[ẢNH CHƯA TẢI: ${n} — ${escapeText(r ? r.failure : 'không rõ')}]]`;
  });
}
