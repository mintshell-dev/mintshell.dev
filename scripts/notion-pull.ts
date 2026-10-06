/**
 * `pnpm notion:pull` — kéo bài Status = Ready từ database Notion "Mintshell" về
 * `content/writeups/_import/<slug>/` (gitignore, ngoài build), rồi in báo cáo cảnh báo.
 *
 * An toàn mặc định (ADR 0013): KHÔNG xuất bản, KHÔNG tự sửa/xóa khi thấy cảnh báo. Tác giả tự
 * soát rồi tự chuyển bài sang `content/writeups/<slug>/`. Chạy thủ công, ngoài CI; token chỉ
 * đọc từ `.env` (docs/workflow.md).
 */
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient, NotionError } from './notion/api.ts';
import { applyImages, type ImageOutcome, renderPage } from './notion/blocks.ts';
import { buildFrontmatter, COLUMNS } from './notion/frontmatter.ts';
import { downloadImage, imageFileName } from './notion/images.ts';
import { buildReport, type PostResult, type Skipped } from './notion/report.ts';
import { scanMarkdown } from './notion/scan.ts';
import type { FetchFn } from './notion/types.ts';

export const READY = 'Ready';
const IMPORT_DIR = 'content/writeups/_import';
const PUBLISHED_DIR = 'content/writeups';

export interface PullOptions {
  token: string;
  databaseId: string;
  /** Ghi đè `_import/<slug>/` đã có (mặc định: bỏ qua để không mất phần đang soát). */
  force: boolean;
  /**
   * Tải cả ảnh `external` (host bất kỳ). Mặc định KHÔNG: tải từ host lạ làm lộ IP thật của tác giả cho
   * host đó (review M4, M2). Ảnh Notion lưu (S3) luôn được tải.
   */
  externalImages?: boolean;
  /** Gốc repo. */
  root: string;
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

export interface PullOutcome {
  results: PostResult[];
  skipped: Skipped[];
  /** Có bài lỗi API giữa chừng (mã thoát 1). */
  failed: boolean;
  report: string;
}

export async function pull(options: PullOptions): Promise<PullOutcome> {
  const doFetch: FetchFn = options.fetch ?? ((input, init) => fetch(input, init));
  const client = createClient({
    token: options.token,
    fetch: doFetch,
    ...(options.sleep ? { sleep: options.sleep } : {}),
  });
  const rel = (p: string) => relative(options.root, p).split('\\').join('/');

  const pages = await client.queryByStatus(options.databaseId, COLUMNS.status, READY);
  const results: PostResult[] = [];
  const skipped: Skipped[] = [];
  const seen = new Set<string>();
  let failed = false;

  for (const page of pages) {
    const fm = buildFrontmatter(page.properties);
    const label = fm.title || fm.rawSlug || page.id;
    if (!fm.slug) {
      skipped.push({ label, reason: `slug "${fm.rawSlug}" không hợp lệ (ASCII thường, gạch nối)` });
      continue;
    }
    if (seen.has(fm.slug)) {
      skipped.push({ label, reason: `slug "${fm.slug}" trùng với bài khác trong lần kéo này` });
      continue;
    }
    seen.add(fm.slug);

    const dir = join(options.root, IMPORT_DIR, fm.slug);
    const exists = existsSync(dir);
    if (exists && !options.force) {
      skipped.push({
        label,
        reason: `${rel(dir)} đã có (đang soát?); chạy lại với --force để ghi đè`,
      });
      continue;
    }

    const otherWarnings: string[] = [];
    if (existsSync(join(options.root, PUBLISHED_DIR, fm.slug))) {
      otherWarnings.push(
        `slug đã xuất bản ở ${PUBLISHED_DIR}/${fm.slug}/ (slug vĩnh viễn; đây là bản cập nhật?)`,
      );
    }

    let rendered;
    try {
      rendered = renderPage(await client.fetchBlockTree(page.id));
    } catch (err) {
      failed = true;
      skipped.push({
        label,
        reason: err instanceof NotionError ? err.message : 'lỗi khi lấy nội dung',
      });
      continue;
    }
    otherWarnings.push(...rendered.warnings);

    // Ghi nguyên tử: viết toàn bộ vào thư mục tạm (cùng _import/, đã gitignore), chỉ thay bản nháp cũ
    // (--force) khi đã ghi xong. Lỗi giữa chừng (tải ảnh, ghi file) không làm mất phần đang soát.
    const tmp = join(options.root, IMPORT_DIR, `.tmp-${fm.slug}-${process.pid}-${Date.now()}`);
    const images: PostResult['images'] = [];
    const imageFailures: PostResult['imageFailures'] = [];
    const externalSkipped: PostResult['externalSkipped'] = [];
    const replacements = new Map<number, ImageOutcome>();
    let content: string;
    try {
      await mkdir(tmp, { recursive: true });
      for (const img of rendered.images) {
        if (img.source === 'external' && !options.externalImages) {
          externalSkipped.push({ index: img.index, url: img.url });
          replacements.set(img.index, { external: img.url });
          continue;
        }
        let dl: Awaited<ReturnType<typeof downloadImage>>;
        try {
          dl = img.url
            ? await downloadImage(img.url, doFetch)
            : { ok: false, reason: 'block ảnh không có URL' };
        } catch (err) {
          dl = {
            ok: false,
            reason: `lỗi khi tải (${err instanceof Error ? err.name : 'không rõ'})`,
          };
        }
        if (!dl.ok) {
          // URL ảnh Notion là URL S3 có chữ ký: không chép ra file hay báo cáo, chỉ ghi số thứ tự.
          const where = img.source === 'external' ? ` (${img.url.slice(0, 120)})` : '';
          imageFailures.push({ index: img.index, reason: `${dl.reason}${where}` });
          replacements.set(img.index, { failure: dl.reason });
          continue;
        }
        const name = imageFileName(img.index, img.url, dl.kind);
        await mkdir(join(tmp, 'images'), { recursive: true });
        await writeFile(join(tmp, 'images', name), dl.bytes);
        images.push({ path: rel(join(dir, 'images', name)), metadata: dl.metadata });
        replacements.set(img.index, { path: `./images/${name}` });
      }
      content = fm.yaml + '\n' + applyImages(rendered.markdown, replacements);
      await writeFile(join(tmp, 'vi.md'), content, 'utf8');
      if (exists) await rm(dir, { recursive: true, force: true });
      await rename(tmp, dir);
    } catch (err) {
      await rm(tmp, { recursive: true, force: true });
      failed = true;
      const reason = err instanceof Error ? err.name : 'không rõ';
      skipped.push({
        label,
        reason: `lỗi khi ghi bài (${reason}); bản nháp cũ (nếu có) giữ nguyên`,
      });
      continue;
    }
    const file = join(dir, 'vi.md');

    results.push({
      slug: fm.slug,
      title: fm.title,
      file: rel(file),
      images,
      imageFailures,
      externalSkipped,
      findings: scanMarkdown(content),
      unsupported: rendered.unsupported,
      frontmatterWarnings: fm.warnings,
      otherWarnings,
    });
  }

  return { results, skipped, failed, report: buildReport(results, skipped) };
}

const USAGE = `Dùng: pnpm notion:pull [--force] [--external-images]

Kéo bài Status = ${READY} từ Notion về ${IMPORT_DIR}/<slug>/ để soát. Không xuất bản gì.
  --force             ghi đè thư mục ${IMPORT_DIR}/<slug>/ đã có
  --external-images   tải cả ảnh external (host ngoài Notion; lộ IP của bạn cho host đó)
Cần NOTION_TOKEN và NOTION_DATABASE_ID trong .env (xem .env.example, docs/workflow.md).`;

/** Đọc biến môi trường bắt buộc; trả danh sách tên biến còn thiếu. */
export function readEnv(env: NodeJS.ProcessEnv): {
  token: string;
  databaseId: string;
  missing: string[];
} {
  const token = env.NOTION_TOKEN?.trim() ?? '';
  const databaseId = env.NOTION_DATABASE_ID?.trim() ?? '';
  const missing = [!token && 'NOTION_TOKEN', !databaseId && 'NOTION_DATABASE_ID'].filter(
    (v): v is string => !!v,
  );
  return { token, databaseId, missing };
}

async function main(argv: string[]): Promise<number> {
  const known = new Set(['--force', '--external-images', '--help', '-h']);
  const unknown = argv.filter((a) => !known.has(a));
  if (argv.includes('--help') || argv.includes('-h') || unknown.length) {
    if (unknown.length) console.error(`Tham số không hợp lệ: ${unknown.join(' ')}\n`);
    console.log(USAGE);
    return unknown.length ? 1 : 0;
  }

  const { token, databaseId, missing } = readEnv(process.env);
  if (missing.length) {
    console.error(`Thiếu biến môi trường: ${missing.join(', ')}.`);
    console.error('Chép .env.example thành .env rồi điền giá trị (docs/workflow.md). Dừng.');
    return 1;
  }

  const root = fileURLToPath(new URL('..', import.meta.url));
  try {
    const outcome = await pull({
      token,
      databaseId,
      force: argv.includes('--force'),
      externalImages: argv.includes('--external-images'),
      root,
    });
    console.log(outcome.report);
    return outcome.failed ? 1 : 0;
  } catch (err) {
    const message =
      err instanceof NotionError ? err.message : err instanceof Error ? err.name : 'lỗi không rõ';
    console.error(`notion:pull dừng: ${message.split(token).join('[REDACTED]')}`);
    console.error('CHƯA xuất bản gì.');
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
