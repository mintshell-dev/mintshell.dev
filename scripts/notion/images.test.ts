import { describe, expect, it } from 'vitest';

import {
  blockedHost,
  downloadImage,
  findMetadata,
  imageFileName,
  MAX_IMAGE_BYTES,
  MAX_REDIRECTS,
  sniff,
} from './images.ts';
import { jpeg, png, response } from './test-helpers.ts';
import type { FetchFn } from './types.ts';

const fetchReturning =
  (make: () => Response): FetchFn =>
  async () =>
    make();

describe('sniff (magic bytes)', () => {
  it('nhận PNG/JPEG/GIF/WebP, SVG; còn lại null', () => {
    expect(sniff(png())).toBe('png');
    expect(sniff(jpeg())).toBe('jpeg');
    expect(sniff(new TextEncoder().encode('GIF89a......'))).toBe('gif');
    expect(sniff(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(sniff(new TextEncoder().encode('  <?xml version="1.0"?><svg onload="x">'))).toBe('svg');
    expect(sniff(new TextEncoder().encode('<html>'))).toBeNull();
  });
});

describe('findMetadata', () => {
  it('PNG: tEXt/iTXt/zTXt/eXIf', () => {
    expect(findMetadata(png(), 'png')).toEqual([]);
    expect(findMetadata(png(['tEXt', 'eXIf']), 'png')).toEqual(['tEXt', 'eXIf']);
  });

  it('JPEG: Exif, XMP', () => {
    expect(findMetadata(jpeg(), 'jpeg')).toEqual([]);
    expect(findMetadata(jpeg('Exif'), 'jpeg')).toEqual(['Exif']);
    expect(findMetadata(jpeg('XMP'), 'jpeg')).toEqual(['XMP']);
  });

  it('JPEG: bỏ qua byte đệm 0xFF trước marker, vẫn thấy Exif', () => {
    const j = jpeg('Exif');
    const padded = new Uint8Array([0xff, 0xd8, 0xff, ...j.subarray(2)]);
    expect(findMetadata(padded, 'jpeg')).toEqual(['Exif']);
  });

  it('GIF: Comment Extension, XMP', () => {
    const head = [...'GIF89a'].map((c) => c.charCodeAt(0)).concat(Array(7).fill(0));
    const xmp = [...'XMP DataXMP'].map((c) => c.charCodeAt(0));
    expect(findMetadata(new Uint8Array([...head, 0x2c]), 'gif')).toEqual([]);
    expect(findMetadata(new Uint8Array([...head, 0x21, 0xfe, 1, 0x61, 0]), 'gif')).toEqual([
      'Comment',
    ]);
    expect(findMetadata(new Uint8Array([...head, 0x21, 0xff, 11, ...xmp]), 'gif')).toEqual(['XMP']);
  });

  it('WebP: chunk EXIF/XMP', () => {
    const chunk = (t: string, n: number) =>
      [...t].map((c) => c.charCodeAt(0)).concat([n, 0, 0, 0], Array(n).fill(0));
    const webp = new Uint8Array([
      ...[...'RIFF'].map((c) => c.charCodeAt(0)),
      0,
      0,
      0,
      0,
      ...[...'WEBP'].map((c) => c.charCodeAt(0)),
      ...chunk('VP8 ', 2),
      ...chunk('EXIF', 3),
      0,
      ...chunk('XMP ', 2),
    ]);
    expect(findMetadata(webp, 'webp')).toEqual(['EXIF', 'XMP']);
  });
});

describe('imageFileName', () => {
  it('01-<tên ASCII>.<ext theo kiểu thật>, bỏ dấu, ≤ 40 ký tự', () => {
    expect(
      imageFileName(1, 'https://s3.example/abc/Ảnh%20đăng%20nhập.PNG?X-Amz-Signature=x', 'png'),
    ).toBe('01-anh-dang-nhap.png');
    expect(imageFileName(12, 'https://img.example/a.webp', 'jpeg')).toBe('12-a.jpg');
    expect(imageFileName(3, 'https://img.example/', 'gif')).toBe('03-image.gif');
    expect(imageFileName(4, 'https://img.example/' + 'x'.repeat(80) + '.png', 'png')).toBe(
      `04-${'x'.repeat(40)}.png`,
    );
  });
});

describe('downloadImage', () => {
  it('tải ảnh hợp lệ, trả kiểu + metadata', async () => {
    const r = await downloadImage(
      'https://s3.example/a.png',
      fetchReturning(() => response(png(['tEXt']))),
    );
    expect(r).toMatchObject({ ok: true, kind: 'png', metadata: ['tEXt'] });
  });

  it('không gửi header Authorization tới host ảnh', async () => {
    let headers: RequestInit['headers'];
    await downloadImage('https://s3.example/a.png', async (_u, init) => {
      headers = init?.headers;
      return response(png());
    });
    expect(headers).toBeUndefined();
  });

  it.each([
    ['http://img.example/a.png', () => response(png()), /https/],
    ['https://img.example/a.svg', () => response('<svg onload="alert(1)"></svg>'), /SVG/],
    ['https://img.example/a', () => response('<html></html>'), /không phải PNG/],
    ['https://img.example/a', () => response(null, { status: 403 }), /HTTP 403/],
    [
      'https://img.example/a',
      () => response(png(), { headers: { 'content-length': String(MAX_IMAGE_BYTES + 1) } }),
      /quá 10 MiB/,
    ],
  ])('từ chối %s', async (url, make, reason) => {
    const r = await downloadImage(url, fetchReturning(make));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(reason);
  });

  it('dừng khi luồng dữ liệu vượt 10 MiB dù không khai content-length', async () => {
    const big = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(png());
        for (let i = 0; i < 11; i++) c.enqueue(new Uint8Array(1024 * 1024));
        c.close();
      },
    });
    const r = await downloadImage(
      'https://img.example/a',
      fetchReturning(() => response(big)),
    );
    expect(!r.ok && r.reason).toMatch(/quá 10 MiB/);
  });

  it('lỗi mạng (vd. tường lửa) → lý do rõ ràng, không ném lỗi', async () => {
    const r = await downloadImage('https://img.example/a', async () => {
      throw new TypeError('fetch failed');
    });
    expect(!r.ok && r.reason).toMatch(/không kết nối được img\.example.*tường lửa/);
  });

  it('theo chuyển hướng https hợp lệ (thủ công, redirect: manual)', async () => {
    const seen: string[] = [];
    const r = await downloadImage('https://img.example/a', async (url, init) => {
      seen.push(`${url} ${String(init?.redirect)}`);
      return url.endsWith('/a')
        ? response(null, { status: 302, headers: { location: 'https://cdn.example/b.png' } })
        : response(png());
    });
    expect(r.ok).toBe(true);
    expect(seen).toEqual(['https://img.example/a manual', 'https://cdn.example/b.png manual']);
  });

  it.each([
    ['http://img.example/x.png', /không phải https/],
    ['https://127.0.0.1/x.png', /host bị chặn \(IP loopback\)/],
    ['https://192.168.1.10/x.png', /host bị chặn \(IP riêng tư\)/],
    ['https://localhost/x.png', /host bị chặn \(localhost\)/],
    ['https://2130706433/x.png', /host bị chặn \(IP loopback\)/],
    ['https://0x7f.1/x.png', /host bị chặn \(IP loopback\)/],
    ['https://[::1]/x.png', /host bị chặn \(IPv6 literal\)/],
  ])('chặn chuyển hướng tới %s TRƯỚC khi gửi request', async (target, reason) => {
    const seen: string[] = [];
    const r = await downloadImage('https://img.example/a', async (url) => {
      seen.push(url);
      return response(null, { status: 302, headers: { location: target } });
    });
    expect(!r.ok && r.reason).toMatch(reason);
    expect(seen).toEqual(['https://img.example/a']);
  });

  it(`dừng sau ${MAX_REDIRECTS} lần chuyển hướng`, async () => {
    let n = 0;
    const r = await downloadImage('https://img.example/0', async () =>
      response(null, { status: 302, headers: { location: `https://img.example/${++n}` } }),
    );
    expect(!r.ok && r.reason).toMatch(/quá 3 lần/);
    expect(n).toBe(MAX_REDIRECTS + 1);
  });

  it('chặn URL ban đầu trỏ tới host nội bộ, không gửi request', async () => {
    let called = false;
    const r = await downloadImage('https://10.0.0.5/a.png', async () => {
      called = true;
      return response(png());
    });
    expect(!r.ok && r.reason).toMatch(/host bị chặn/);
    expect(called).toBe(false);
  });
});

describe('blockedHost', () => {
  it('cho phép tên miền và IP công khai; chặn localhost, IP không công khai, IPv6 literal', () => {
    expect(blockedHost('prod-files-secure.s3.us-west-2.amazonaws.com')).toBeNull();
    expect(blockedHost('8.8.8.8')).toBeNull();
    expect(blockedHost('api.LOCALHOST')).toBe('localhost');
    expect(blockedHost('169.254.169.254')).toBe('IP link-local');
    expect(blockedHost('[fd00::1]')).toBe('IPv6 literal');
  });
});
