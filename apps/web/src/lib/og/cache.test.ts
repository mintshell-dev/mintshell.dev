import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cachedRender, cacheKey, OG_HEIGHT, OG_WIDTH, pngSize } from './cache';

/** PNG giả tối thiểu: chữ ký + IHDR với kích thước cho trước (đủ cho pngSize). */
function fakePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

const cover = fakePng(OG_WIDTH, OG_HEIGHT);
const input = { slug: 'valenfind', locale: 'vi', title: 'ValenFind', tags: ['lfi'] };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'og-cache-test-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('pngSize', () => {
  it('đọc kích thước từ IHDR', () => {
    expect(pngSize(fakePng(10, 20))).toEqual({ width: 10, height: 20 });
  });

  it('không phải PNG → undefined', () => {
    expect(pngSize(Buffer.from('not a png at all, definitely not'))).toBeUndefined();
  });
});

describe('cacheKey', () => {
  it('đổi dữ liệu hoặc dấu vân tay thì đổi khóa', () => {
    const base = cacheKey('fp', input);
    expect(cacheKey('fp', input)).toBe(base);
    expect(cacheKey('fp', { ...input, title: 'Khác' })).not.toBe(base);
    expect(cacheKey('fp2', input)).not.toBe(base);
  });
});

describe('cachedRender', () => {
  it('lần hai dùng lại cache, không render lại', async () => {
    const render = vi.fn(async () => cover);
    const cache = { dir, fingerprint: 'fp' };
    expect((await cachedRender(cache, input, render)).hit).toBe(false);
    const second = await cachedRender(cache, input, render);
    expect(second.hit).toBe(true);
    expect(second.png.equals(cover)).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
    // Không để lại file tạm.
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('đổi một trường thì render lại', async () => {
    const render = vi.fn(async () => cover);
    const cache = { dir, fingerprint: 'fp' };
    await cachedRender(cache, input, render);
    await cachedRender(cache, { ...input, tags: ['lfi', 'idor'] }, render);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('file cache hỏng hoặc sai kích thước thì render lại', async () => {
    const render = vi.fn(async () => cover);
    const cache = { dir, fingerprint: 'fp' };
    const file = join(dir, `${cacheKey('fp', input)}.png`);
    writeFileSync(file, 'hỏng');
    expect((await cachedRender(cache, input, render)).hit).toBe(false);
    writeFileSync(file, fakePng(100, 100));
    expect((await cachedRender(cache, input, render)).hit).toBe(false);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('renderer trả ảnh sai kích thước thì lỗi, không ghi cache', async () => {
    const cache = { dir, fingerprint: 'fp' };
    await expect(cachedRender(cache, input, async () => fakePng(1, 1))).rejects.toThrow();
    expect(readdirSync(dir)).toEqual([]);
  });

  it('không có cache thì luôn render', async () => {
    const render = vi.fn(async () => cover);
    await cachedRender(undefined, input, render);
    await cachedRender(undefined, input, render);
    expect(render).toHaveBeenCalledTimes(2);
  });
});
