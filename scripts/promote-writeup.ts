/**
 * `pnpm writeups:promote <slug> | --all [--force]` — chuyển CƠ HỌC `content/writeups/_import/<slug>/<vi|en>.md`
 * thành `content/writeups/<slug>/<vi|en>.mdx` (+ copy ảnh của bản đó). Mỗi bản xử lý riêng: bản đích đã có thì
 * bỏ qua (trừ khi `--force`), bản kia vẫn chuyển. Chỉ đổi cú pháp theo quy tắc văn bản
 * (scripts/promote/transform.ts): không đọc hiểu bài, không đoán loại callout, không viết description/alt,
 * không đổi `draft`, không xóa `_import/`. Phần cần đọc hiểu được liệt kê trong báo cáo để tác giả làm tay.
 */
import { constants, existsSync } from 'node:fs';
import { lstat, realpath, mkdir, mkdtemp, open, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Locale, LOCALES, SLUG_RE } from './notion/frontmatter.ts';
import { hasLocalePrefix, ownedBy, replaceEntries, RollbackError } from './notion/swap.ts';
import {
  MISSING_ALT,
  MISSING_DESCRIPTION,
  promoteMarkdown,
  type PromoteResult,
} from './promote/transform.ts';

const IMPORT_DIR = 'content/writeups/_import';
const PUBLISHED_DIR = 'content/writeups';
// Chỉ định dạng `notion:pull` tải về (không SVG/HTML), tên không chứa `..`.
const IMAGE_NAME = /^\w[\w-]*(\.[\w-]+)*\.(png|jpe?g|gif|webp)$/i;

/** Lọc ký tự điều khiển/không in được trước khi in nội dung bài ra terminal. */
const printable = (s: string): string => s.replace(/[^\x20-\x7e]/g, '?');

/** Như `printable` nhưng giữ nguyên Unicode in được (emoji) để tác giả nhận ra nhãn callout lạ; chỉ
 *  chặn ký tự điều khiển/định dạng vô hình (cùng cách lọc `\p{Cc}`/`\p{Cf}` của chữ trên ảnh OG, ADR 0012). */
const safeLabel = (s: string): string => s.replace(/[\p{Cc}\p{Cf}]/gu, '?');

export interface PromoteOptions {
  root: string;
  /** Rỗng + `all` → mọi thư mục hợp lệ trong `_import/`. */
  slugs: string[];
  all: boolean;
  /** Ghi đè `content/writeups/<slug>/<locale>.mdx` đã có (mặc định: bỏ qua để không mất phần đã sửa tay). */
  force: boolean;
}

export interface PromoteOutcome {
  report: string;
  failed: boolean;
}

const isInside = (parent: string, child: string): boolean =>
  child.startsWith(parent + sep) && child !== parent;

/**
 * Đọc một file thường mà không đi theo symlink: `O_NOFOLLOW` + `fstat` trên cùng file descriptor, nên không có khe
 * TOCTOU giữa lúc kiểm và lúc đọc (review L1). `O_NONBLOCK`: FIFO không làm treo. Không phải file thường → `null`.
 */
async function readRegular(path: string): Promise<Buffer | null> {
  let fh;
  try {
    fh = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
  } catch {
    return null;
  }
  try {
    return (await fh.stat()).isFile() ? await fh.readFile() : null;
  } finally {
    await fh.close();
  }
}

async function listAllSlugs(importDir: string): Promise<string[]> {
  if (!existsSync(importDir)) return [];
  const entries = await readdir(importDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && SLUG_RE.test(e.name))
    .map((e) => e.name)
    .sort();
}

/**
 * Copy ảnh phẳng của các bản đang chuyển (`wanted`): chỉ file thường, tên an toàn; trả về cảnh báo cho file bị
 * bỏ. Ảnh của bản không chuyển bị bỏ qua im lặng. Ảnh trùng tên một file đích KHÔNG thuộc bản đang chuyển
 * (`keep`: ảnh không tiền tố đã có, có thể đang được bản kia dùng) được giữ nguyên, không ghi đè (review M1).
 */
async function copyImages(
  from: string,
  to: string,
  wanted: (name: string) => boolean,
  keep: (name: string) => boolean,
): Promise<{ copied: number; warnings: string[] }> {
  const warnings: string[] = [];
  let copied = 0;
  if (!existsSync(from) || !(await lstat(from)).isDirectory()) return { copied, warnings };
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (!entry.isFile() || !IMAGE_NAME.test(entry.name)) {
      warnings.push(
        `bỏ qua images/${entry.name.replace(/[^\w.-]/g, '?')} (không phải file thường hoặc tên lạ)`,
      );
      continue;
    }
    if (!wanted(entry.name)) continue;
    if (keep(entry.name)) {
      warnings.push(
        `giữ images/${entry.name} đã có ở đích (không thuộc riêng bản này), không ghi đè`,
      );
      continue;
    }
    const bytes = await readRegular(join(from, entry.name));
    if (!bytes) {
      warnings.push(`bỏ qua images/${entry.name} (không phải file thường)`);
      continue;
    }
    await mkdir(to, { recursive: true });
    await writeFile(join(to, entry.name), bytes);
    copied++;
  }
  return { copied, warnings };
}

/** Việc tay của một bản (đánh số dòng theo `<locale>.md`). */
function manualWork(locale: Locale, result: PromoteResult): string[] {
  const lines: string[] = [];
  const md = `${locale}.md`;
  if (result.missingDescription) lines.push(`    việc tay: description còn ${MISSING_DESCRIPTION}`);
  for (const a of result.missingAlts)
    lines.push(`    việc tay: alt còn ${MISSING_ALT}: ${printable(a.path)} (${md}:${a.line})`);
  for (const r of result.mdxRisks.slice(0, 20))
    lines.push(`    ! MDX ${md}:${r.line}: ${r.reason}`);
  if (result.mdxRisks.length > 20)
    lines.push(`    ! … và ${result.mdxRisks.length - 20} dòng khác`);
  if (result.callouts > 0) {
    const breakdown = Object.entries(result.calloutsByType)
      .filter(([, n]) => n > 0)
      .map(([type, n]) => `${type}:${n}`)
      .join(', ');
    lines.push(`    đã gán type cho ${result.callouts} khối callout (${breakdown})`);
  }
  for (const emoji of result.unknownCalloutEmojis)
    lines.push(
      `    ! callout emoji lạ "${safeLabel(emoji)}" (${md}), đã dùng type="note" — tự soát lại`,
    );
  if (result.leftoverCallouts > 0)
    lines.push(
      `    việc tay: còn ${result.leftoverCallouts} marker **[Callout chưa đổi (lồng trong danh sách/blockquote?)`,
    );
  return lines;
}

async function promoteOne(slug: string, o: PromoteOptions): Promise<string[]> {
  const importDir = resolve(o.root, IMPORT_DIR);
  const pubDir = resolve(o.root, PUBLISHED_DIR);
  if (!SLUG_RE.test(slug)) return [`✗ ${printable(slug)}: slug không hợp lệ, bỏ qua`];

  const src = resolve(importDir, slug);
  const dest = resolve(pubDir, slug);
  if (!isInside(importDir, src) || !isInside(pubDir, dest))
    return [`✗ ${slug}: đường dẫn ngoài thư mục cho phép`];

  try {
    const st = await lstat(src);
    if (!st.isDirectory() || !isInside(await realpath(importDir), await realpath(src)))
      return [`✗ ${slug}: _import/${slug} phải là thư mục thật (không symlink)`];
  } catch {
    return [`✗ ${slug}: không có _import/${slug}`];
  }

  const lines: string[] = [];
  const ready: { locale: Locale; result: PromoteResult }[] = [];
  for (const locale of LOCALES) {
    const srcFile = join(src, `${locale}.md`);
    let st;
    try {
      st = await lstat(srcFile);
    } catch {
      continue; // Bài chưa có bản này: hợp lệ.
    }
    const key = `${slug}/${locale}`;
    if (!st.isFile()) {
      lines.push(`✗ ${key}: ${relative(o.root, srcFile)} phải là file thường`);
      continue;
    }
    const destFile = join(dest, `${locale}.mdx`);
    if (existsSync(destFile) && !o.force) {
      lines.push(`- ${key}: bỏ qua, ${relative(o.root, destFile)} đã có (dùng --force để ghi đè)`);
      continue;
    }
    const bytes = await readRegular(srcFile);
    if (!bytes) {
      lines.push(`✗ ${key}: ${relative(o.root, srcFile)} phải là file thường`);
      continue;
    }
    const source = bytes.toString('utf8');
    if (source.includes('\r')) {
      lines.push(
        `✗ ${key}: ${locale}.md có CRLF, chuyển về LF trước (script không đổi byte ngoài quy tắc)`,
      );
      continue;
    }
    ready.push({ locale, result: promoteMarkdown(source) });
  }
  if (lines.length === 0 && ready.length === 0)
    return [`✗ ${slug}: _import/${slug} không có ${LOCALES.map((l) => `${l}.md`).join(' / ')}`];
  if (ready.length === 0) return lines;

  // Chỉ thay `<locale>.mdx` + `images/<locale>-*` của các bản đang chuyển; bản kia, ảnh không tiền tố, file thêm
  // tay được giữ (ở `content/` ảnh không tiền tố có thể đang được bản kia dùng: không bao giờ xóa, review M1).
  const owners = ready.map(({ locale }) => ownedBy(locale, 'mdx'));
  const owns = (rel: string) => owners.some((f) => f(rel));
  // Ảnh không tiền tố (nháp trước song ngữ) đi kèm bản vi khi copy, nhưng không ghi đè ảnh đã có ở đích.
  const withVi = ready.some((r) => r.locale === 'vi');
  const wanted = (name: string) => owns(`images/${name}`) || (withVi && !hasLocalePrefix(name));
  const keep = (name: string) => !owns(`images/${name}`) && existsSync(join(dest, 'images', name));
  await mkdir(pubDir, { recursive: true });
  const tmp = await mkdtemp(join(pubDir, '.promote-'));
  try {
    for (const { locale, result } of ready)
      await writeFile(join(tmp, `${locale}.mdx`), result.markdown, 'utf8');
    const images = await copyImages(join(src, 'images'), join(tmp, 'images'), wanted, keep);
    await replaceEntries(dest, tmp, owns);

    for (const { locale, result } of ready) {
      lines.push(`✓ ${slug}/${locale} → ${relative(o.root, join(dest, `${locale}.mdx`))}`);
      lines.push(...manualWork(locale, result));
    }
    lines.push(`    ảnh đã copy: ${images.copied}`);
    for (const w of images.warnings) lines.push(`    ! ${w}`);
    return lines;
  } catch (err) {
    const name = (e: unknown) => (e instanceof Error ? e.name : 'không rõ');
    if (err instanceof RollbackError) {
      // Báo đúng trạng thái (review M2): backup nằm cạnh thư mục tạm (`.promote-*`, đã gitignore).
      return [
        ...lines,
        `✗ ${slug}: lỗi khi ghi (${name(err.cause)}) và KHÔI PHỤC CHƯA TRỌN: ${relative(o.root, dest)}/ có thể ` +
          `thiếu hoặc lẫn file; bản cũ còn ở ${relative(o.root, err.backup)}/ (${err.pending.map(printable).join(', ')}), ` +
          'tự chép về rồi xóa thư mục đó',
      ];
    }
    return [...lines, `✗ ${slug}: lỗi khi ghi (${name(err)}), chưa thay đổi gì`];
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export async function promote(o: PromoteOptions): Promise<PromoteOutcome> {
  const slugs = o.all ? await listAllSlugs(resolve(o.root, IMPORT_DIR)) : o.slugs;
  const lines: string[] = [];
  for (const slug of slugs) lines.push(...(await promoteOne(slug, o)));
  if (slugs.length === 0) lines.push('Không có bài nào để chuyển.');
  const failed = lines.some((l) => l.startsWith('✗'));
  lines.push(
    '',
    'TỔNG KẾT: CHƯA đổi draft, CHƯA xóa _import/, CHƯA commit. Soát các "việc tay" ở trên.',
  );
  return { report: lines.join('\n'), failed };
}

export async function main(argv: string[]): Promise<number> {
  const all = argv.includes('--all');
  const force = argv.includes('--force');
  const slugs = argv.filter((a) => !a.startsWith('--'));
  if (
    all === slugs.length > 0 ||
    argv.some((a) => a.startsWith('--') && a !== '--all' && a !== '--force')
  ) {
    console.error(
      'Cách dùng: pnpm writeups:promote <slug> [--force]  |  pnpm writeups:promote --all [--force]',
    );
    return 1;
  }
  const root = fileURLToPath(new URL('..', import.meta.url));
  const outcome = await promote({ root, slugs, all, force });
  console.log(outcome.report);
  return outcome.failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
