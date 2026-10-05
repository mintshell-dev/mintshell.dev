import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Kích thước ảnh OG chuẩn (Open Graph/Twitter `summary_large_image`). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Kích thước đọc từ IHDR, hoặc `undefined` nếu không phải PNG hợp lệ. */
export function pngSize(buf: Buffer): { width: number; height: number } | undefined {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return undefined;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const isCover = (buf: Buffer): boolean => {
  const size = pngSize(buf);
  return size?.width === OG_WIDTH && size.height === OG_HEIGHT;
};

export interface OgCache {
  /** Thư mục cache (gitignore), vd. `node_modules/.cache/og`. */
  dir: string;
  /**
   * Dấu vân tay renderer: mã nguồn renderer, màu token, font, phiên bản sharp. Đổi bất kỳ thứ gì
   * trong đó thì mọi khóa đổi theo, không phục vụ ảnh cũ.
   */
  fingerprint: string;
}

/** Khóa cache: sha256 của dấu vân tay + dữ liệu ảnh (thứ tự khóa cố định do nơi gọi dựng). */
export function cacheKey(fingerprint: string, input: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify([fingerprint, input]))
    .digest('hex');
}

/**
 * Trả ảnh từ cache nếu dữ liệu ảnh và renderer không đổi; nếu không thì render và lưu lại.
 * File cache hỏng (không phải PNG 1200×630) bị bỏ qua và render lại. Ghi qua file tạm + rename
 * để lần build bị ngắt giữa chừng không để lại ảnh dở. Không có `cache` thì luôn render.
 */
export async function cachedRender(
  cache: OgCache | undefined,
  input: unknown,
  render: () => Promise<Buffer>,
): Promise<{ png: Buffer; hit: boolean }> {
  if (!cache) return { png: await render(), hit: false };
  const file = join(cache.dir, `${cacheKey(cache.fingerprint, input)}.png`);
  try {
    const cached = readFileSync(file);
    if (isCover(cached)) return { png: cached, hit: true };
  } catch {
    // Chưa có trong cache.
  }
  const png = await render();
  if (!isCover(png)) throw new Error(`Ảnh OG phải là PNG ${OG_WIDTH}×${OG_HEIGHT}`);
  mkdirSync(cache.dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, png);
  renameSync(tmp, file);
  return { png, hit: false };
}
