import { type Locale, VERSIONS } from './frontmatter.ts';
import type { Finding } from './scan.ts';

/** Kết quả kéo một bài, đủ để dựng báo cáo (hàm thuần). Đường dẫn tương đối gốc repo. */
export interface PostResult {
  slug: string;
  /** Bản ngôn ngữ (cột Version): mỗi bài có thể có hai bản cùng slug. */
  locale: Locale;
  title: string;
  file: string;
  images: { path: string; metadata: string[] }[];
  imageFailures: { index: number; reason: string }[];
  /** Ảnh external không tải (mặc định; bật bằng --external-images). */
  externalSkipped: { index: number; url: string }[];
  findings: Finding[];
  unsupported: string[];
  frontmatterWarnings: string[];
  otherWarnings: string[];
}

export interface Skipped {
  label: string;
  reason: string;
}

export interface Totals {
  posts: number;
  skipped: number;
  flag: number;
  ip: number;
  prompt: number;
  path: number;
  metadata: number;
  imageFailures: number;
  external: number;
  unsupported: number;
  frontmatter: number;
  other: number;
}

export const REMINDER =
  'CHƯA xuất bản gì; hãy soát _import/ trước khi chuyển sang content/writeups/';

/** Nhãn một bản: `slug/locale`. */
const key = (r: PostResult) => `${r.slug}/${r.locale}`;

const count = (r: PostResult, kind: Finding['kind']) =>
  r.findings.filter((f) => f.kind === kind).length;
const withMetadata = (r: PostResult) => r.images.filter((i) => i.metadata.length).length;

export function totals(results: PostResult[], skipped: Skipped[]): Totals {
  const sum = (f: (r: PostResult) => number) => results.reduce((n, r) => n + f(r), 0);
  return {
    posts: results.length,
    skipped: skipped.length,
    flag: sum((r) => count(r, 'flag')),
    ip: sum((r) => count(r, 'ip')),
    prompt: sum((r) => count(r, 'prompt')),
    path: sum((r) => count(r, 'path')),
    metadata: sum(withMetadata),
    imageFailures: sum((r) => r.imageFailures.length),
    external: sum((r) => r.externalSkipped.length),
    unsupported: sum((r) => r.unsupported.length),
    frontmatter: sum((r) => r.frontmatterWarnings.length),
    other: sum((r) => r.otherWarnings.length),
  };
}

/** Một dòng, luôn in cuối cùng để không lẫn vào giữa báo cáo dài. */
export function summaryLine(t: Totals): string {
  return (
    [
      `TỔNG KẾT: kéo về ${t.posts} bài (bỏ qua ${t.skipped})`,
      `flag ${t.flag}`,
      `IP ${t.ip}`,
      `prompt ${t.prompt}`,
      `đường dẫn home ${t.path}`,
      `ảnh có metadata ${t.metadata}`,
      `ảnh lỗi ${t.imageFailures}`,
      `ảnh external không tải ${t.external}`,
      `block chưa hỗ trợ ${t.unsupported}`,
      `frontmatter ${t.frontmatter}`,
      `khác ${t.other}`,
    ].join(' · ') + ` — ${REMINDER}`
  );
}

function table(results: PostResult[]): string[] {
  const head = [
    'Bài',
    'Ảnh tải/lỗi/ngoài',
    'Flag',
    'IP',
    'Prompt',
    'Home',
    'Metadata ảnh',
    'Chưa hỗ trợ',
    'Frontmatter',
    'Khác',
  ];
  const rows = results.map((r) => [
    key(r),
    `${r.images.length}/${r.imageFailures.length}/${r.externalSkipped.length}`,
    String(count(r, 'flag')),
    String(count(r, 'ip')),
    String(count(r, 'prompt')),
    String(count(r, 'path')),
    String(withMetadata(r)),
    String(r.unsupported.length),
    String(r.frontmatterWarnings.length),
    String(r.otherWarnings.length),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const fmt = (cells: string[]) =>
    `| ${cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join(' | ')} |`;
  return [fmt(head), `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`, ...rows.map(fmt)];
}

/**
 * Lọc ký tự điều khiển C0/C1 (trừ xuống dòng): tiêu đề hay link từ Notion chứa escape ANSI có thể xóa
 * dòng cảnh báo trên terminal, OSC 52 có thể ghi vào clipboard. Lọc cả ký tự định hướng bidi (U+202A–202E,
 * U+2066–2069, U+200E/200F) và zero-width (U+200B–200D, U+FEFF): đảo hay giấu chữ trên terminal (review L3).
 */
export function sanitizeTerminal(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,
    '\uFFFD',
  );
}

/**
 * Mỗi phần tử báo cáo là MỘT dòng; xuống dòng chỉ có thể đến từ chuỗi Notion (tiêu đề, slug, Version…) và
 * có thể dùng để giả một dòng báo cáo hợp lệ → hiện thành `⏎` (review L3).
 */
const oneLine = (line: string) => line.replace(/\r\n|\r|\n/g, '⏎');

export function buildReport(results: PostResult[], skipped: Skipped[]): string {
  const out: string[] = ['', '=== notion:pull — báo cáo ===', ''];

  if (results.length) out.push(...table(results));
  else out.push('Không có bài nào được kéo về.');

  for (const r of results) {
    out.push('', `## ${key(r)} — ${r.title || '(không tiêu đề)'}`);
    for (const f of r.findings) {
      out.push(`  ${r.file}:${f.line}  [${f.kind}] ${f.match}${f.note ? ` (${f.note})` : ''}`);
    }
    for (const w of r.frontmatterWarnings) out.push(`  ${r.file}:1  [frontmatter] ${w}`);
    for (const w of r.otherWarnings) out.push(`  [khác] ${w}`);
    if (r.unsupported.length) out.push(`  [chưa hỗ trợ] ${r.unsupported.join(', ')}`);
    for (const f of r.imageFailures) {
      out.push(`  [ảnh lỗi] ${String(f.index).padStart(2, '0')}: ${f.reason}`);
    }
    for (const e of r.externalSkipped) {
      out.push(
        `  [ảnh external không tải] ${String(e.index).padStart(2, '0')}: ${e.url.slice(0, 200)} ` +
          '(tự tải nếu tin host, hoặc chạy lại với --external-images)',
      );
    }
    if (r.images.length) {
      out.push('  Ảnh cần tự mở xem (script không đọc được nội dung ảnh):');
      for (const i of r.images) {
        out.push(
          `    ${i.path}${i.metadata.length ? `  [metadata: ${i.metadata.join(', ')}]` : ''}`,
        );
      }
    }
  }

  if (skipped.length) {
    out.push('', 'Bỏ qua:');
    for (const s of skipped) out.push(`  - ${s.label}: ${s.reason}`);
  }

  out.push('', summaryLine(totals(results, skipped)));
  return sanitizeTerminal(out.map(oneLine).join('\n'));
}

/** Dòng Ready thiếu cột Version (dừng cả lần chạy). */
export interface MissingVersion {
  title: string;
  slug: string;
}

/** Báo cáo khi dừng vì có dòng Ready thiếu Version: không đoán bản nào, không ghi file nào. */
export function buildAbortReport(rows: MissingVersion[]): string {
  const out = [
    '',
    '=== notion:pull — DỪNG ===',
    '',
    `${rows.length} dòng Status = Ready chưa chọn Version (${Object.keys(VERSIONS).join(' | ')}):`,
    ...rows.map((r) => `  - ${r.title} — slug "${r.slug}"`),
    '',
    'Điền cột Version trong Notion rồi chạy lại. CHƯA ghi file nào, CHƯA xuất bản gì.',
  ];
  return sanitizeTerminal(out.map(oneLine).join('\n'));
}
