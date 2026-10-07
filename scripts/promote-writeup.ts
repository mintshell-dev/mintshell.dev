/**
 * `pnpm writeups:promote <slug> | --all [--force]` — chuyển CƠ HỌC `content/writeups/_import/<slug>/vi.md`
 * thành `content/writeups/<slug>/vi.mdx` (+ copy `images/`). Chỉ đổi cú pháp theo quy tắc văn bản
 * (scripts/promote/transform.ts): không đọc hiểu bài, không đoán loại callout, không viết description/alt,
 * không đổi `draft`, không xóa `_import/`. Phần cần đọc hiểu được liệt kê trong báo cáo để tác giả làm tay.
 */
import { existsSync } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  realpath,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SLUG_RE } from './notion/frontmatter.ts';
import { MISSING_ALT, MISSING_DESCRIPTION, promoteMarkdown } from './promote/transform.ts';

const IMPORT_DIR = 'content/writeups/_import';
const PUBLISHED_DIR = 'content/writeups';
// Chỉ định dạng `notion:pull` tải về (không SVG/HTML), tên không chứa `..`.
const IMAGE_NAME = /^\w[\w-]*(\.[\w-]+)*\.(png|jpe?g|gif|webp)$/i;

/** Lọc ký tự điều khiển/không in được trước khi in nội dung bài ra terminal. */
const printable = (s: string): string => s.replace(/[^\x20-\x7e]/g, '?');

export interface PromoteOptions {
  root: string;
  /** Rỗng + `all` → mọi thư mục hợp lệ trong `_import/`. */
  slugs: string[];
  all: boolean;
  /** Ghi đè `content/writeups/<slug>/` đã có (mặc định: bỏ qua để không mất phần đã sửa tay). */
  force: boolean;
}

export interface PromoteOutcome {
  report: string;
  failed: boolean;
}

const isInside = (parent: string, child: string): boolean =>
  child.startsWith(parent + sep) && child !== parent;

async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
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

/** Copy `images/` phẳng: chỉ file thường, tên an toàn; trả về cảnh báo cho file bị bỏ. */
async function copyImages(
  from: string,
  to: string,
): Promise<{ copied: number; warnings: string[] }> {
  const warnings: string[] = [];
  let copied = 0;
  if (!existsSync(from) || !(await lstat(from)).isDirectory()) return { copied, warnings };
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (!entry.isFile() || !IMAGE_NAME.test(entry.name)) {
      warnings.push(
        `bỏ qua images/${entry.name.replace(/[^\w.-]/g, '?')} (không phải file thường hoặc tên lạ)`,
      );
      continue;
    }
    await copyFile(join(from, entry.name), join(to, entry.name));
    copied++;
  }
  return { copied, warnings };
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
  const srcFile = join(src, 'vi.md');
  if (!(await isRegularFile(srcFile)))
    return [`✗ ${slug}: không có ${relative(o.root, srcFile)} (file thường)`];
  if (existsSync(dest) && !o.force)
    return [`- ${slug}: bỏ qua, ${relative(o.root, dest)} đã có (dùng --force để ghi đè)`];

  const source = await readFile(srcFile, 'utf8');
  if (source.includes('\r'))
    return [`✗ ${slug}: vi.md có CRLF, chuyển về LF trước (script không đổi byte ngoài quy tắc)`];
  const result = promoteMarkdown(source);

  await mkdir(pubDir, { recursive: true });
  const tmp = await mkdtemp(join(pubDir, '.promote-'));
  try {
    await writeFile(join(tmp, 'vi.mdx'), result.markdown, 'utf8');
    const images = await copyImages(join(src, 'images'), join(tmp, 'images'));
    await chmod(tmp, 0o755);
    let backup: string | null = null;
    if (existsSync(dest)) {
      // Không xóa trước: đổi tên bản cũ, thay bản mới, rồi mới xóa; lỗi thì trả bản cũ về.
      backup = `${tmp}-old`;
      await rename(dest, backup);
    }
    try {
      await rename(tmp, dest);
    } catch (err) {
      if (backup) await rename(backup, dest);
      throw err;
    }
    if (backup) {
      // --force chỉ thay vi.mdx và images/; mọi file khác của bài (en.mdx, ảnh thêm tay…) được giữ lại.
      for (const entry of await readdir(backup)) {
        if (entry !== 'vi.mdx' && entry !== 'images')
          await rename(join(backup, entry), join(dest, entry));
      }
      await rm(backup, { recursive: true, force: true });
    }

    const lines = [
      `✓ ${slug} → ${relative(o.root, join(dest, 'vi.mdx'))} (ảnh đã copy: ${images.copied})`,
    ];
    for (const w of images.warnings) lines.push(`    ! ${w}`);
    if (result.missingDescription)
      lines.push(`    việc tay: description còn ${MISSING_DESCRIPTION}`);
    for (const a of result.missingAlts)
      lines.push(`    việc tay: alt còn ${MISSING_ALT}: ${printable(a.path)} (vi.md:${a.line})`);
    for (const r of result.mdxRisks.slice(0, 20))
      lines.push(`    ! MDX vi.md:${r.line}: ${r.reason}`);
    if (result.mdxRisks.length > 20)
      lines.push(`    ! … và ${result.mdxRisks.length - 20} dòng khác`);
    if (result.callouts > 0)
      lines.push(`    việc tay: chọn type cho ${result.callouts} khối <Callout type="note">`);
    if (result.leftoverCallouts > 0)
      lines.push(
        `    việc tay: còn ${result.leftoverCallouts} marker **[Callout chưa đổi (lồng trong danh sách/blockquote?)`,
      );
    return lines;
  } catch (err) {
    await rm(tmp, { recursive: true, force: true });
    return [
      `✗ ${slug}: lỗi khi ghi (${err instanceof Error ? err.name : 'không rõ'}), chưa thay đổi gì`,
    ];
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
