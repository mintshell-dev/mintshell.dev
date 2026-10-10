import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { promote } from '../promote-writeup.ts';

const SAMPLE = [
  '---',
  "title: 'Mẫu'",
  "description: '[[THIẾU MÔ TẢ]]'",
  'draft: true',
  'translation: pending',
  '---',
  '',
  '![](./images/a.png)',
  '',
  '> **[Callout 💡]** ghi chú',
  '',
].join('\n');

let root: string;
const imp = (...p: string[]) => join(root, 'content/writeups/_import', ...p);
const pub = (...p: string[]) => join(root, 'content/writeups', ...p);
const opts = (o: Partial<Parameters<typeof promote>[0]> = {}) => ({
  root,
  slugs: ['mau'],
  all: false,
  force: false,
  ...o,
});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'promote-'));
  await mkdir(imp('mau', 'images'), { recursive: true });
  await writeFile(imp('mau', 'vi.md'), SAMPLE);
  await writeFile(imp('mau', 'images', 'a.png'), 'png');
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('promote', () => {
  it('ghi vi.mdx, copy ảnh, báo việc tay, không đổi draft và không xóa _import', async () => {
    const r = await promote(opts());
    expect(r.failed).toBe(false);
    const out = await readFile(pub('mau', 'vi.mdx'), 'utf8');
    expect(out).toContain('draft: true');
    expect(out).toContain('<Callout type="insight">');
    expect(out).toContain('![[[THIẾU ALT]]](./images/a.png)');
    expect(existsSync(pub('mau', 'images', 'a.png'))).toBe(true);
    expect(existsSync(imp('mau', 'vi.md'))).toBe(true);
    expect(await readFile(imp('mau', 'vi.md'), 'utf8')).toBe(SAMPLE);
    expect(r.report).toContain('description còn [[THIẾU MÔ TẢ]]');
    expect(r.report).toContain('./images/a.png (vi.md:8)');
    expect(r.report).toContain('đã gán type cho 1 khối callout (insight:1)');
    expect(r.report).toContain('CHƯA đổi draft, CHƯA xóa _import/');
    expect((await readdir(pub())).filter((n) => n.startsWith('.promote-'))).toEqual([]);
  });

  it('bỏ qua đích đã có; --force mới ghi đè', async () => {
    await mkdir(pub('mau'), { recursive: true });
    await writeFile(pub('mau', 'vi.mdx'), 'đã sửa tay');
    expect((await promote(opts())).report).toContain('đã có');
    expect(await readFile(pub('mau', 'vi.mdx'), 'utf8')).toBe('đã sửa tay');
    await writeFile(pub('mau', 'en.mdx'), 'bản en');
    await promote(opts({ force: true }));
    expect(await readFile(pub('mau', 'vi.mdx'), 'utf8')).toContain('<Callout');
    // --force chỉ thay vi.mdx và images/, giữ file anh em.
    expect(await readFile(pub('mau', 'en.mdx'), 'utf8')).toBe('bản en');
    expect((await readdir(pub())).filter((n) => n.startsWith('.promote-'))).toEqual([]);
  });

  it('từ chối vi.md có CRLF và _import/<slug> là symlink', async () => {
    await mkdir(imp('crlf'), { recursive: true });
    await writeFile(imp('crlf', 'vi.md'), '---\r\ntitle: x\r\n---\r\nthân\r\n');
    await symlink(imp('mau'), imp('ngoai'));
    const r = await promote(opts({ slugs: ['crlf', 'ngoai'] }));
    expect(r.report).toContain('có CRLF');
    expect(r.report).toContain('phải là thư mục thật');
    expect(existsSync(pub('crlf'))).toBe(false);
    expect(existsSync(pub('ngoai'))).toBe(false);
  });

  it('chỉ copy ảnh png/jpg/gif/webp, bỏ svg/html và tên lạ', async () => {
    for (const n of ['x.svg', 'y.html', 'z.JPG', 'w..png', 'v.png'])
      await writeFile(imp('mau', 'images', n), 'x');
    const r = await promote(opts());
    expect(existsSync(pub('mau', 'images', 'z.JPG'))).toBe(true);
    expect(existsSync(pub('mau', 'images', 'v.png'))).toBe(true);
    for (const n of ['x.svg', 'y.html', 'w..png'])
      expect(existsSync(pub('mau', 'images', n))).toBe(false);
    expect(r.report).toContain('bỏ qua images/x.svg');
  });

  it('callout emoji lạ → type="note" + cảnh báo trong report', async () => {
    await writeFile(
      imp('mau', 'vi.md'),
      '---\ndescription: ok\n---\n> **[Callout ❓]** nội dung lạ\n',
    );
    const r = await promote(opts());
    expect(r.failed).toBe(false);
    expect(await readFile(pub('mau', 'vi.mdx'), 'utf8')).toContain('<Callout type="note">');
    expect(r.report).toContain('callout emoji lạ "❓" (vi.md), đã dùng type="note"');
  });

  it('báo dòng có cú pháp MDX chưa escape nhưng vẫn chuyển', async () => {
    await writeFile(
      imp('mau', 'vi.md'),
      '---\ndescription: ok\n---\nCó {process.env.X} và <script>\n\nimport a from "b"\n\n`{trong code}` và \\{đã escape\\}\n',
    );
    const r = await promote(opts());
    expect(r.report).toContain('MDX vi.md:4: { } chưa escape');
    expect(r.report).toContain('MDX vi.md:4: < mở thẻ');
    expect(r.report).toContain('MDX vi.md:6: import/export');
    expect(r.report).not.toContain('vi.md:8');
  });

  it('từ chối slug xấu và không ghi ra ngoài', async () => {
    const r = await promote(opts({ slugs: ['../x', 'a/b', 'Mau'] }));
    expect(r.failed).toBe(true);
    expect(r.report.match(/slug không hợp lệ/g)).toHaveLength(3);
    expect(existsSync(join(root, 'content/x'))).toBe(false);
    expect(existsSync(pub('Mau'))).toBe(false);
  });

  it('báo lỗi khi thiếu vi.md hoặc vi.md là symlink', async () => {
    await mkdir(imp('trong'), { recursive: true });
    await mkdir(imp('lien-ket'), { recursive: true });
    await symlink(imp('mau', 'vi.md'), imp('lien-ket', 'vi.md'));
    const r = await promote(opts({ slugs: ['trong', 'lien-ket'] }));
    expect(r.failed).toBe(true);
    expect(existsSync(pub('lien-ket'))).toBe(false);
  });

  it('bỏ qua symlink và thư mục con trong images/', async () => {
    await symlink('/etc/hostname', imp('mau', 'images', 'lien-ket.png'));
    await mkdir(imp('mau', 'images', 'con'));
    const r = await promote(opts());
    expect(existsSync(pub('mau', 'images', 'lien-ket.png'))).toBe(false);
    expect(existsSync(pub('mau', 'images', 'con'))).toBe(false);
    expect(r.report).toContain('bỏ qua images/lien-ket.png');
  });

  it('--all chuyển mọi thư mục hợp lệ và bỏ thư mục tên lạ', async () => {
    await mkdir(imp('hai'), { recursive: true });
    await writeFile(imp('hai', 'vi.md'), '---\ndescription: ok\n---\nthân\n');
    await mkdir(imp('Bad_Name'), { recursive: true });
    await writeFile(imp('Bad_Name', 'vi.md'), 'x');
    const r = await promote(opts({ slugs: [], all: true }));
    expect(existsSync(pub('mau', 'vi.mdx'))).toBe(true);
    expect(existsSync(pub('hai', 'vi.mdx'))).toBe(true);
    expect(existsSync(pub('Bad_Name'))).toBe(false);
    expect(r.failed).toBe(false);
  });
});

describe('promote song ngữ (vi.md / en.md)', () => {
  const EN = SAMPLE.replace("title: 'Mẫu'", "title: 'Sample'").replace(
    './images/a.png',
    './images/en-01-a.png',
  );

  beforeEach(async () => {
    await writeFile(imp('mau', 'en.md'), EN);
    await writeFile(imp('mau', 'images', 'en-01-a.png'), 'png en');
    await writeFile(imp('mau', 'images', 'vi-01-a.png'), 'png vi');
  });

  it('chuyển cả hai bản, mỗi bản chỉ kèm ảnh của nó (ảnh không tiền tố đi với vi)', async () => {
    const r = await promote(opts());
    expect(r.failed).toBe(false);
    expect(await readFile(pub('mau', 'en.mdx'), 'utf8')).toContain("title: 'Sample'");
    expect(await readFile(pub('mau', 'en.mdx'), 'utf8')).toContain('<Callout type="insight">');
    expect(await readFile(pub('mau', 'vi.mdx'), 'utf8')).toContain("title: 'Mẫu'");
    expect((await readdir(pub('mau', 'images'))).sort()).toEqual([
      'a.png',
      'en-01-a.png',
      'vi-01-a.png',
    ]);
    expect(r.report).toContain('✓ mau/vi → content/writeups/mau/vi.mdx');
    expect(r.report).toContain('✓ mau/en → content/writeups/mau/en.mdx');
    expect(r.report).toContain('./images/en-01-a.png (en.md:8)');
  });

  it('chỉ có en.md → chỉ en.mdx + ảnh en-*', async () => {
    await rm(imp('mau', 'vi.md'));
    const r = await promote(opts());
    expect(r.failed).toBe(false);
    expect(existsSync(pub('mau', 'vi.mdx'))).toBe(false);
    expect(existsSync(pub('mau', 'en.mdx'))).toBe(true);
    expect(await readdir(pub('mau', 'images'))).toEqual(['en-01-a.png']);
  });

  it('bản vi đã xuất bản → bỏ qua vi (không đụng), vẫn chuyển en', async () => {
    await mkdir(pub('mau', 'images'), { recursive: true });
    await writeFile(pub('mau', 'vi.mdx'), 'đã xuất bản');
    await writeFile(pub('mau', 'images', 'vi-01-a.png'), 'ảnh vi đã che');
    const r = await promote(opts());
    expect(r.failed).toBe(false);
    expect(r.report).toMatch(/- mau\/vi: bỏ qua, content\/writeups\/mau\/vi\.mdx đã có/);
    expect(await readFile(pub('mau', 'vi.mdx'), 'utf8')).toBe('đã xuất bản');
    expect(await readFile(pub('mau', 'images', 'vi-01-a.png'), 'utf8')).toBe('ảnh vi đã che');
    expect(existsSync(pub('mau', 'images', 'a.png'))).toBe(false);
    expect(await readFile(pub('mau', 'en.mdx'), 'utf8')).toContain("title: 'Sample'");
  });

  it('--force khi _import chỉ có en.md → thay en.mdx + ảnh en-*, giữ bản vi', async () => {
    await rm(imp('mau', 'vi.md'));
    await mkdir(pub('mau', 'images'), { recursive: true });
    await writeFile(pub('mau', 'vi.mdx'), 'đã xuất bản');
    await writeFile(pub('mau', 'en.mdx'), 'en cũ');
    await writeFile(pub('mau', 'images', 'vi-01-a.png'), 'ảnh vi đã che');
    await writeFile(pub('mau', 'images', 'en-09-cu.png'), 'ảnh en cũ');
    await promote(opts({ force: true }));
    expect(await readFile(pub('mau', 'en.mdx'), 'utf8')).toContain('<Callout');
    expect(existsSync(pub('mau', 'images', 'en-09-cu.png'))).toBe(false);
    expect(await readFile(pub('mau', 'vi.mdx'), 'utf8')).toBe('đã xuất bản');
    expect(await readFile(pub('mau', 'images', 'vi-01-a.png'), 'utf8')).toBe('ảnh vi đã che');
  });

  it('ảnh không tiền tố đã có ở đích (bản en đang dùng) → không xóa, không ghi đè, kể cả --force', async () => {
    await mkdir(pub('mau', 'images'), { recursive: true });
    await writeFile(pub('mau', 'en.mdx'), 'đã xuất bản, dùng ./images/a.png và ./images/cover.png');
    await writeFile(pub('mau', 'images', 'a.png'), 'ảnh en đang dùng');
    await writeFile(pub('mau', 'images', 'cover.png'), 'cover');
    await rm(imp('mau', 'en.md'));

    for (const force of [false, true]) {
      const r = await promote(opts({ force }));
      expect(r.failed).toBe(false);
      expect(await readFile(pub('mau', 'images', 'a.png'), 'utf8')).toBe('ảnh en đang dùng');
      expect(await readFile(pub('mau', 'images', 'cover.png'), 'utf8')).toBe('cover');
      expect(r.report).toContain('giữ images/a.png đã có ở đích');
      expect(await readFile(pub('mau', 'vi.mdx'), 'utf8')).toContain("title: 'Mẫu'");
      expect(await readFile(pub('mau', 'images', 'vi-01-a.png'), 'utf8')).toBe('png vi');
    }
  });

  it('ảnh trong _import/ là symlink tới file ngoài → không copy nội dung', async () => {
    const secret = join(root, 'bi-mat.txt');
    await writeFile(secret, 'KHÔNG ĐƯỢC CHÉP');
    await symlink(secret, imp('mau', 'images', 'vi-02-x.png'));
    const r = await promote(opts());
    expect(existsSync(pub('mau', 'images', 'vi-02-x.png'))).toBe(false);
    expect(r.report).toContain('bỏ qua images/vi-02-x.png');
  });
});
