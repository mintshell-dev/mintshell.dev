/**
 * Thay một nhóm file trong thư mục bài bằng bản mới dựng sẵn ở thư mục tạm, có rollback. Dùng cho cả
 * `notion:pull` (`_import/<slug>/`) lẫn `writeups:promote` (`content/writeups/<slug>/`): hai bản ngôn ngữ
 * dùng chung một thư mục, nên thay bản này KHÔNG được đụng tới file của bản kia hay file tác giả thêm tay.
 */
import { lstat, mkdir, mkdtemp, readdir, rename, rm, rmdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import type { Locale } from './frontmatter.ts';

/**
 * Tên ảnh `notion:pull` sinh ra trước song ngữ (`imageFileName`: `01-<tên>.<ext>`, không tiền tố ngôn ngữ). Chỉ
 * những ảnh khớp đúng mẫu này trong `_import/` mới được coi là của bản vi; ảnh tên khác (tác giả thêm tay, dùng
 * chung) không bao giờ bị coi là của bản nào (review M1).
 */
const LEGACY_IMAGE = /^\d{2,}-[a-z0-9-]+\.(png|jpe?g|gif|webp)$/;

/**
 * File (đường dẫn tương đối, `/`) thuộc bản `locale`: `<locale>.<ext>` và `images/<locale>-*`. `legacy`: thêm ảnh
 * nháp cũ không tiền tố (khớp `LEGACY_IMAGE`) cho bản vi; chỉ dùng trong `_import/`, không dùng ở `content/`
 * (ở đó ảnh không tiền tố có thể đang được bản en dùng).
 */
/** Tên ảnh có tiền tố ngôn ngữ (`vi-…`, `en-…`). */
export const hasLocalePrefix = (name: string): boolean => /^(vi|en)-/.test(name);

export function ownedBy(
  locale: Locale,
  ext: 'md' | 'mdx',
  legacy = false,
): (rel: string) => boolean {
  return (rel) => {
    if (rel === `${locale}.${ext}`) return true;
    if (!rel.startsWith('images/')) return false;
    const name = rel.slice('images/'.length);
    if (name.includes('/')) return false;
    return name.startsWith(`${locale}-`) || (legacy && locale === 'vi' && LEGACY_IMAGE.test(name));
  };
}

/**
 * Rollback không trọn: file cũ chưa trả về được vẫn nằm trong `backup` (không mất). Người gọi phải báo đúng
 * trạng thái, không được nói "giữ nguyên" (review M2).
 */
export class RollbackError extends Error {
  readonly backup: string;
  readonly pending: string[];
  constructor(backup: string, pending: string[], cause: unknown) {
    super(`khôi phục chưa trọn: ${pending.length} file cũ còn ở ${backup}`, { cause });
    this.name = 'RollbackError';
    this.backup = backup;
    this.pending = pending;
  }
}

/** Mọi entry không phải thư mục dưới `root` (đệ quy, không đi theo symlink), đường dẫn tương đối dùng `/`. */
async function files(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => !e.isDirectory())
    .map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

/**
 * Tạo thư mục (nếu chưa có) và bắt buộc là thư mục thật: không ghi xuyên symlink ra ngoài. Trả về `true` nếu
 * chính lần gọi này tạo ra `path` (giá trị trả về của `mkdir`, không phải `existsSync` trước đó: tránh race I1).
 */
async function realDir(path: string): Promise<boolean> {
  const created = (await mkdir(path, { recursive: true })) !== undefined;
  if (!(await lstat(path)).isDirectory()) throw new Error(`không phải thư mục thật: ${path}`);
  return created;
}

/** Xóa thư mục nếu rỗng (không đệ quy: không bao giờ xóa file của lần chạy khác); lỗi thì bỏ qua. */
const rmdirIfEmpty = (path: string) => rmdir(path).catch(() => undefined);

/**
 * Chuyển mọi file trong `staging` vào `dir` (tạo `dir` nếu chưa có). Chỉ đụng tới file mà `owns` nhận:
 * - file mới trùng tên một file KHÔNG thuộc `owns` trong `dir` → ném lỗi trước khi thay đổi gì;
 * - file cũ thuộc `owns` được dời sang backup trước (`<staging>-old-*`, cạnh staging nên nằm trong vùng đã
 *   gitignore), xong hết mới xóa backup.
 * Lỗi giữa chừng: gỡ file mới, trả file cũ về chỗ (cố hết sức từng file), rồi ném lại lỗi gốc. Có file chưa trả
 * về được → ném `RollbackError` và GIỮ backup. `staging` không bị xóa (người gọi dọn).
 */
export async function replaceEntries(
  dir: string,
  staging: string,
  owns: (rel: string) => boolean,
): Promise<void> {
  const created = await realDir(dir);
  const incoming = await files(staging);
  const existing = await files(dir);
  const conflicts = incoming.filter((rel) => !owns(rel) && existing.includes(rel));
  if (conflicts.length) {
    if (created) await rmdirIfEmpty(dir);
    throw new Error(`file đích đã có và không thuộc bản này: ${conflicts.join(', ')}`);
  }
  const old = existing.filter(owns);

  const backup = await mkdtemp(`${staging}-old-`);
  const backedUp: string[] = [];
  const moved: string[] = [];
  const madeDirs: string[] = [];
  try {
    for (const rel of old) {
      await mkdir(dirname(join(backup, rel)), { recursive: true });
      await rename(join(dir, rel), join(backup, rel));
      backedUp.push(rel);
    }
    for (const rel of incoming) {
      const parent = dirname(join(dir, rel));
      if (await realDir(parent)) madeDirs.push(parent);
      await rename(join(staging, rel), join(dir, rel));
      moved.push(rel);
    }
  } catch (err) {
    const pending: string[] = [];
    for (const rel of moved) {
      try {
        await rm(join(dir, rel), { force: true });
      } catch {
        pending.push(`${rel} (bản mới chưa gỡ)`);
      }
    }
    for (const rel of backedUp) {
      try {
        await rename(join(backup, rel), join(dir, rel));
      } catch {
        pending.push(rel);
      }
    }
    if (pending.length) throw new RollbackError(backup, pending, err);
    await rm(backup, { recursive: true, force: true });
    for (const d of madeDirs.reverse()) await rmdirIfEmpty(d);
    if (created) await rmdirIfEmpty(dir);
    throw err;
  }
  // Thành công: backup chỉ còn bản cũ đã được thay; xóa lỗi cũng không sao (nằm trong vùng gitignore).
  await rm(backup, { recursive: true, force: true }).catch(() => undefined);
}
