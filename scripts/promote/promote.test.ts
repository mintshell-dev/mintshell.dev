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
    expect(out).toContain('<Callout type="note">');
    expect(out).toContain('![[[THIẾU ALT]]](./images/a.png)');
    expect(existsSync(pub('mau', 'images', 'a.png'))).toBe(true);
    expect(existsSync(imp('mau', 'vi.md'))).toBe(true);
    expect(await readFile(imp('mau', 'vi.md'), 'utf8')).toBe(SAMPLE);
    expect(r.report).toContain('description còn [[THIẾU MÔ TẢ]]');
    expect(r.report).toContain('./images/a.png (vi.md:8)');
    expect(r.report).toContain('chọn type cho 1 khối');
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
