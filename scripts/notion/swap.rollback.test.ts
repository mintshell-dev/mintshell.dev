import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rollback tự lỗi (EACCES/EBUSY…) khó dựng bằng filesystem thật, nên giả `rename` của `node:fs/promises`:
 * mọi lệnh rename có đích đúng bằng `failInto` đều ném lỗi.
 */
const state = vi.hoisted(() => ({ failInto: null as string | null }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    rename: async (from: string, to: string) => {
      if (String(to) === state.failInto)
        throw Object.assign(new Error('giả lập'), { code: 'EBUSY' });
      return real.rename(from, to);
    },
  };
});

const { ownedBy, replaceEntries, RollbackError } = await import('./swap.ts');

let root: string;
const at = (...p: string[]) => join(root, ...p);
async function put(path: string, body: string): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'swap-rb-'));
  state.failInto = null;
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('replaceEntries: rollback không trọn (review M2)', () => {
  it('ném RollbackError, GIỮ backup chứa bản cũ, giữ lỗi gốc ở cause', async () => {
    await put(at('bai', 'en.md'), 'en đang soát');
    await put(at('bai', 'vi.md'), 'vi');
    await put(at('ngoai', 'f'), 'x');
    // images/ là symlink ra ngoài: dù lỗi thế nào cũng không được ghi gì vào `ngoai/`.
    await symlink(at('ngoai'), at('bai', 'images'));
    await put(at('stage', 'en.md'), 'en mới');
    await put(at('stage', 'images', 'en-01.png'), 'ảnh');
    // Mọi rename vào bai/en.md đều lỗi: chuyển bản mới vào (lỗi gốc) lẫn trả bản cũ về (rollback lỗi).
    state.failInto = at('bai', 'en.md');

    const err = await replaceEntries(at('bai'), at('stage'), ownedBy('en', 'md')).catch((e) => e);
    expect(err).toBeInstanceOf(RollbackError);
    expect(err.pending).toEqual(['en.md']);
    expect(err.cause).toBeInstanceOf(Error);
    expect(readFileSync(join(err.backup, 'en.md'), 'utf8')).toBe('en đang soát');
    expect(err.backup.startsWith(`${at('stage')}-old-`)).toBe(true);
    expect(readFileSync(at('bai', 'vi.md'), 'utf8')).toBe('vi');
    expect(existsSync(at('bai', 'en.md'))).toBe(false);
    expect(readdirSync(at('ngoai'))).toEqual(['f']);
  });
});
