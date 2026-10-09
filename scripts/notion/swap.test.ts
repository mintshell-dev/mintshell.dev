import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ownedBy, replaceEntries } from './swap.ts';

let root: string;
const at = (...p: string[]) => join(root, ...p);

async function put(path: string, body = path): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'swap-'));
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('ownedBy', () => {
  it('bản en: en.md và images/en-*', () => {
    const en = ownedBy('en', 'md');
    expect(['en.md', 'images/en-01-a.png'].every(en)).toBe(true);
    expect(['vi.md', 'en.mdx', 'images/vi-01-a.png', 'images/01-a.png', 'x/en.md'].some(en)).toBe(
      false,
    );
  });

  it('mặc định (content/): ảnh không tiền tố không thuộc bản nào (có thể đang được bản kia dùng)', () => {
    const vi = ownedBy('vi', 'mdx');
    expect(['vi.mdx', 'images/vi-01-a.png'].every(vi)).toBe(true);
    expect(
      [
        'vi.md',
        'images/en-01-a.png',
        'images/sub/vi-x.png',
        'images/01-a.png',
        'images/cover.png',
      ].some(vi),
    ).toBe(false);
  });

  it('legacy (_import/): bản vi nhận ĐÚNG mẫu tên pull cũ, không nhận ảnh tác giả thêm tay', () => {
    const vi = ownedBy('vi', 'md', true);
    expect(['images/01-login-page.png', 'images/12-a.jpg', 'images/100-image.webp'].every(vi)).toBe(
      true,
    );
    expect(
      [
        'images/cover.png',
        'images/a.png',
        'images/01-Che.png',
        'images/01-a.svg',
        'images/1-a.png',
      ].some(vi),
    ).toBe(false);
    expect(ownedBy('en', 'md', true)('images/01-login-page.png')).toBe(false);
  });
});

describe('replaceEntries', () => {
  it('chỉ thay file của bản được chọn, giữ nguyên bản kia và file lạ', async () => {
    await put(at('bai', 'vi.md'), 'vi cũ');
    await put(at('bai', 'en.md'), 'en cũ');
    await put(at('bai', 'images', 'vi-01-a.png'), 'ảnh vi');
    await put(at('bai', 'images', 'en-01-a.png'), 'ảnh en cũ');
    await put(at('bai', 'images', 'en-09-stale.png'), 'ảnh en thừa');
    await put(at('bai', 'ghi-chu.txt'), 'của tác giả');
    await put(at('stage', 'en.md'), 'en mới');
    await put(at('stage', 'images', 'en-01-a.png'), 'ảnh en mới');

    await replaceEntries(at('bai'), at('stage'), ownedBy('en', 'md'));

    expect(readFileSync(at('bai', 'en.md'), 'utf8')).toBe('en mới');
    expect(readFileSync(at('bai', 'images', 'en-01-a.png'), 'utf8')).toBe('ảnh en mới');
    expect(existsSync(at('bai', 'images', 'en-09-stale.png'))).toBe(false);
    expect(readFileSync(at('bai', 'vi.md'), 'utf8')).toBe('vi cũ');
    expect(readFileSync(at('bai', 'images', 'vi-01-a.png'), 'utf8')).toBe('ảnh vi');
    expect(readFileSync(at('bai', 'ghi-chu.txt'), 'utf8')).toBe('của tác giả');
    expect(readdirSync(root).filter((n) => n.includes('-old-'))).toEqual([]);
  });

  it('tạo thư mục đích nếu chưa có', async () => {
    await put(at('stage', 'vi.md'), 'mới');
    await replaceEntries(at('moi'), at('stage'), ownedBy('vi', 'md'));
    expect(readFileSync(at('moi', 'vi.md'), 'utf8')).toBe('mới');
  });

  it('lỗi giữa chừng (images/ là symlink) → trả bản cũ, không ghi xuyên symlink', async () => {
    await put(at('ngoai', 'giu.txt'), 'x');
    await put(at('bai', 'en.md'), 'en cũ');
    await symlink(at('ngoai'), at('bai', 'images'));
    await put(at('stage', 'en.md'), 'en mới');
    await put(at('stage', 'images', 'en-01-a.png'), 'ảnh');

    await expect(replaceEntries(at('bai'), at('stage'), ownedBy('en', 'md'))).rejects.toThrow();
    expect(readFileSync(at('bai', 'en.md'), 'utf8')).toBe('en cũ');
    expect(readdirSync(at('ngoai'))).toEqual(['giu.txt']);
    expect(readdirSync(root).filter((n) => n.includes('-old-'))).toEqual([]);
  });

  it('file mới trùng tên một file KHÔNG thuộc bản này → dừng, không đổi gì, không tạo thư mục rỗng', async () => {
    await put(at('bai', 'images', 'cover.png'), 'ảnh dùng chung');
    await put(at('bai', 'en.md'), 'en cũ');
    await put(at('stage', 'en.md'), 'en mới');
    await put(at('stage', 'images', 'cover.png'), 'đè');
    await expect(replaceEntries(at('bai'), at('stage'), ownedBy('en', 'md'))).rejects.toThrow(
      /images\/cover\.png/,
    );
    expect(readFileSync(at('bai', 'images', 'cover.png'), 'utf8')).toBe('ảnh dùng chung');
    expect(readFileSync(at('bai', 'en.md'), 'utf8')).toBe('en cũ');

    await mkdir(at('trong'));
    await expect(replaceEntries(at('moi'), at('trong'), () => false)).resolves.toBeUndefined();
    await put(at('stage2', 'x.txt'), 'x');
    await put(at('moi2', 'x.txt'), 'có sẵn');
    await expect(replaceEntries(at('moi2'), at('stage2'), () => false)).rejects.toThrow();
    expect(readFileSync(at('moi2', 'x.txt'), 'utf8')).toBe('có sẵn');
  });
});
