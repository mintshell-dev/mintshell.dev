/**
 * Biến đổi văn bản thuần cho `writeups:promote`: KHÔNG đọc hiểu nội dung bài, chỉ đổi cú pháp theo quy tắc.
 * Mọi dòng không khớp quy tắc được giữ nguyên từng byte; dòng trong fenced code không bao giờ bị đụng tới.
 */

export const MISSING_ALT = '[[THIẾU ALT]]';
export const MISSING_DESCRIPTION = '[[THIẾU MÔ TẢ]]';

/** Mở/đóng fenced code kiểu CommonMark (``` hoặc ~~~, đóng bằng cùng ký tự và độ dài >=). */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Theo dõi trạng thái "đang trong fenced code" khi duyệt từng dòng. */
class FenceTracker {
  private open: { char: string; length: number } | null = null;

  isOpen(): boolean {
    return this.open !== null;
  }

  /** Trả về true nếu dòng này nằm trong (hoặc là dòng mở/đóng của) fenced code. */
  inCode(line: string): boolean {
    const m = FENCE.exec(line);
    if (this.open) {
      if (m) {
        const fence = m[1]!;
        const closes =
          fence[0] === this.open.char &&
          fence.length >= this.open.length &&
          line.slice(m[0].length).trim() === '';
        if (closes) this.open = null;
      }
      return true;
    }
    if (m) {
      this.open = { char: m[1]![0]!, length: m[1]!.length };
      return true;
    }
    return false;
  }
}

/** Tách khối frontmatter đầu file (`---` … `---`); không có thì `frontmatter` rỗng. */
export function splitFrontmatter(md: string): { frontmatter: string; body: string } {
  if (!md.startsWith('---\n')) return { frontmatter: '', body: md };
  const end = md.indexOf('\n---\n', 3);
  if (end === -1) return { frontmatter: '', body: md };
  const cut = end + '\n---\n'.length;
  return { frontmatter: md.slice(0, cut), body: md.slice(cut) };
}

/** `description` còn là `[[THIẾU MÔ TẢ]]` (chỉ nhìn frontmatter). */
export function hasMissingDescription(md: string): boolean {
  const { frontmatter } = splitFrontmatter(md);
  return frontmatter
    .split('\n')
    .some((l) => /^description:\s*(['"]?)\[\[THIẾU MÔ TẢ\]\]\1\s*$/.test(l));
}

// `> **[Callout]** nội dung` hoặc `> **[Callout 💡]** nội dung` (do `notion:pull` sinh, ADR 0013).
const CALLOUT_START = /^> \*\*\[Callout(?: [^\]\n]*)?\]\*\*(?: (.*))?$/;

export interface CalloutResult {
  markdown: string;
  /** Số khối đã đổi thành `<Callout type="note">`. */
  count: number;
  /** Marker `**[Callout` còn sót ngoài code (lồng trong danh sách/blockquote…) cần tự xử lý. */
  leftover: number;
}

/**
 * Đổi `> **[Callout …]** X` (cùng các dòng `>` liền sau) thành
 * `<Callout type="note">` + dòng trống + nội dung + dòng trống + `</Callout>`. Loại luôn là `note`:
 * script không đoán loại. Blockquote thường được giữ nguyên.
 */
export function convertCallouts(md: string): CalloutResult {
  const lines = md.split('\n');
  const out: string[] = [];
  const fence = new FenceTracker();
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (fence.inCode(line)) {
      out.push(line);
      continue;
    }
    const start = CALLOUT_START.exec(line);
    if (!start) {
      out.push(line);
      continue;
    }

    const body: string[] = [start[1] ?? ''];
    const inner = new FenceTracker();
    inner.inCode(body[0]!);
    while (i + 1 < lines.length) {
      const next = lines[i + 1]!;
      if (!(next === '>' || next.startsWith('> '))) break;
      const text = next === '>' ? '' : next.slice(2);
      // Trong fenced code của callout, dòng giống marker chỉ là code, không cắt khối.
      const wasInCode = inner.isOpen();
      if (!wasInCode && CALLOUT_START.test(next)) break;
      inner.inCode(text);
      body.push(text);
      i++;
    }
    while (body.length && body[0]!.trim() === '') body.shift();
    while (body.length && body[body.length - 1]!.trim() === '') body.pop();

    if (out.length && out[out.length - 1]!.trim() !== '') out.push('');
    out.push('<Callout type="note">', '', ...body, '', '</Callout>');
    if (i + 1 < lines.length && lines[i + 1]!.trim() !== '') out.push('');
    count++;
  }

  const markdown = out.join('\n');
  return { markdown, count, leftover: countOutsideCode(markdown, /\*\*\[Callout/g) };
}

function countOutsideCode(md: string, re: RegExp): number {
  const fence = new FenceTracker();
  let n = 0;
  for (const line of md.split('\n')) {
    if (fence.inCode(line)) continue;
    n += line.match(re)?.length ?? 0;
  }
  return n;
}

export interface AltResult {
  markdown: string;
  /** Đường dẫn các ảnh còn alt `[[THIẾU ALT]]` (kèm số dòng, tính trong `md` đầu vào). */
  missing: { path: string; line: number }[];
}

// `.*?` (không qua dòng mới) chịu được alt có ngoặc lồng như `[[THIẾU ALT]]`.
const IMAGE = /!\[(.*?)\]\(([^)\s]+)\)/g;

/** Alt rỗng/chỉ khoảng trắng → `[[THIẾU ALT]]`; alt khác giữ nguyên. Không bao giờ tự viết alt. */
export function normalizeImageAlts(md: string): AltResult {
  const fence = new FenceTracker();
  const missing: AltResult['missing'] = [];
  const out = md.split('\n').map((line, index) => {
    if (fence.inCode(line)) return line;
    return line.replace(IMAGE, (m, alt: string, path: string) => {
      const fixed = alt.trim() === '' ? MISSING_ALT : alt;
      if (fixed === MISSING_ALT) missing.push({ path, line: index + 1 });
      return fixed === alt ? m : `![${fixed}](${path})`;
    });
  });
  return { markdown: out.join('\n'), missing };
}

export interface PromoteResult {
  markdown: string;
  callouts: number;
  leftoverCallouts: number;
  missingDescription: boolean;
  missingAlts: AltResult['missing'];
  mdxRisks: MdxRisk[];
}

/** Toàn bộ biến đổi cho một bài. Frontmatter được giữ nguyên văn (kể cả `draft`, `translation`). */
export function promoteMarkdown(md: string): PromoteResult {
  const { frontmatter, body } = splitFrontmatter(md);
  const offset = frontmatter === '' ? 0 : frontmatter.split('\n').length - 1;
  const callouts = convertCallouts(body);
  const alts = normalizeImageAlts(callouts.markdown);
  return {
    markdown: frontmatter + alts.markdown,
    callouts: callouts.count,
    leftoverCallouts: callouts.leftover,
    missingDescription: hasMissingDescription(md),
    mdxRisks: findMdxRisks(md),
    // Số dòng tính trên cả file (cộng độ dài frontmatter) để nhảy tới đúng dòng trong `vi.md`.
    missingAlts: alts.missing.map((m) => ({ ...m, line: m.line + offset })),
  };
}

export interface MdxRisk {
  line: number;
  reason: string;
}

/** Bỏ inline code (`…`, ``…``) để không báo nhầm trong code. */
const stripInlineCode = (line: string): string => line.replace(/(`+)[^`]*?\1/g, '');

/**
 * Báo (không sửa) các dòng ngoài code mà MDX sẽ hiểu là biểu thức/ESM/JSX: `{`/`}` chưa escape, `<` mở thẻ,
 * `import`/`export` đầu dòng, `</Callout` lạ. `notion:pull` đã escape sẵn nên bình thường không có gì;
 * nếu có là bài đã sửa tay hoặc nguồn lạ. Quét trên bản GỐC (trước khi script chèn `<Callout>`).
 */
export function findMdxRisks(md: string): MdxRisk[] {
  const { frontmatter, body } = splitFrontmatter(md);
  const offset = frontmatter === '' ? 0 : frontmatter.split('\n').length - 1;
  const fence = new FenceTracker();
  const risks: MdxRisk[] = [];
  body.split('\n').forEach((raw, index) => {
    if (fence.inCode(raw)) return;
    const line = stripInlineCode(raw);
    const at = index + 1 + offset;
    if (/(^|[^\\])[{}]/.test(line))
      risks.push({ line: at, reason: '{ } chưa escape (MDX chạy như biểu thức)' });
    if (/(^|[^\\])<[A-Za-z/!?]/.test(line))
      risks.push({ line: at, reason: '< mở thẻ JSX/HTML chưa escape' });
    if (/^\s*(import|export)\s/.test(line))
      risks.push({ line: at, reason: 'import/export đầu dòng (ESM chạy lúc build)' });
  });
  return risks;
}
