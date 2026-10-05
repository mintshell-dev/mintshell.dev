import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { woffToSfnt } from './woff';

const require = createRequire(import.meta.url);
const font = (file: string) => readFileSync(require.resolve(`@fontsource/${file}`));

/** Tag bảng của một SFNT, đọc từ table directory. */
const sfntTags = (sfnt: Buffer): string[] =>
  Array.from({ length: sfnt.readUInt16BE(4) }, (_, i) =>
    sfnt.toString('latin1', 12 + i * 16, 16 + i * 16),
  );

describe('woffToSfnt với font fontsource thật', () => {
  it.each([
    'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
    'be-vietnam-pro/files/be-vietnam-pro-vietnamese-600-normal.woff',
  ])('%s', (file) => {
    const woff = font(file);
    const sfnt = woffToSfnt(woff);
    // flavor TrueType, đủ số bảng, tổng kích thước khớp totalSfntSize trong header WOFF.
    expect(sfnt.readUInt32BE(0)).toBe(0x00010000);
    expect(sfnt.readUInt16BE(4)).toBe(woff.readUInt16BE(12));
    expect(sfnt.length).toBe(woff.readUInt32BE(16));
    const tags = sfntTags(sfnt);
    expect(tags).toEqual([...tags].sort());
    for (const required of ['cmap', 'glyf', 'head', 'name']) expect(tags).toContain(required);
    // Bảng head giải nén đúng: magic number 0x5F0F3CF5 tại offset 12.
    const i = tags.indexOf('head');
    const headOffset = sfnt.readUInt32BE(12 + i * 16 + 8);
    expect(sfnt.readUInt32BE(headOffset + 12)).toBe(0x5f0f3cf5);
  });
});

describe('woffToSfnt từ chối đầu vào hỏng', () => {
  it('không có chữ ký wOFF (vd. WOFF2)', () => {
    expect(() =>
      woffToSfnt(font('jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2')),
    ).toThrow(/wOFF/);
  });

  it('mục lục vượt quá độ dài file', () => {
    const header = Buffer.alloc(44);
    header.write('wOFF', 0, 'latin1');
    header.writeUInt16BE(5, 12);
    expect(() => woffToSfnt(header)).toThrow();
  });

  /** WOFF một bảng `head` với dữ liệu nén và độ dài khai báo cho trước. */
  function oneTable(data: Buffer, origLength: number, totalSfntSize = 4096): Buffer {
    const woff = Buffer.alloc(44 + 20 + data.length);
    woff.write('wOFF', 0, 'latin1');
    woff.writeUInt32BE(0x00010000, 4);
    woff.writeUInt16BE(1, 12);
    woff.writeUInt32BE(totalSfntSize, 16);
    woff.write('head', 44, 'latin1');
    woff.writeUInt32BE(64, 48);
    woff.writeUInt32BE(data.length, 52);
    woff.writeUInt32BE(origLength, 56);
    data.copy(woff, 64);
    return woff;
  }

  it('zip bomb: dừng giải nén khi vượt độ dài khai báo', () => {
    // 8 MB số 0 nén còn ~8 KB; khai báo 16 KB (> bản nén nên parser sẽ giải nén).
    const bomb = deflateSync(Buffer.alloc(8 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(16_000);
    // RangeError từ zlib (maxOutputLength) — không phải lỗi độ dài của ta sau khi đã nở hết 8 MB.
    expect(() => woffToSfnt(oneTable(bomb, 16_000, 32_000))).toThrow(RangeError);
  });

  it('totalSfntSize vượt trần thì từ chối trước khi giải nén', () => {
    expect(() => woffToSfnt(oneTable(Buffer.alloc(4), 4, 64 * 1024 * 1024))).toThrow(/quá lớn/);
  });

  it('tổng kích thước không khớp totalSfntSize', () => {
    const data = deflateSync(Buffer.alloc(64));
    expect(() => woffToSfnt(oneTable(data, 64, 4096))).toThrow(/totalSfntSize/);
  });

  it('bảng giải nén sai độ dài', () => {
    const data = deflateSync(Buffer.alloc(64));
    const woff = Buffer.alloc(44 + 20 + data.length);
    woff.write('wOFF', 0, 'latin1');
    woff.writeUInt32BE(0x00010000, 4);
    woff.writeUInt16BE(1, 12);
    woff.writeUInt32BE(4096, 16); // totalSfntSize
    woff.write('head', 44, 'latin1');
    woff.writeUInt32BE(64, 48); // offset
    woff.writeUInt32BE(data.length, 52); // compLength
    woff.writeUInt32BE(128, 56); // origLength sai (thật là 64)
    data.copy(woff, 64);
    expect(() => woffToSfnt(woff)).toThrow(/độ dài/);
  });
});
