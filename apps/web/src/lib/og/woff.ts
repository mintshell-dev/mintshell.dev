import { inflateSync } from 'node:zlib';

/** Trần kích thước SFNT sau giải nén (font của site < 1 MB). */
const MAX_SFNT_SIZE = 16 * 1024 * 1024;

/**
 * Đổi font WOFF 1.0 sang SFNT (TTF/OTF) để Pango/FreeType trong sharp đọc được (ADR 0012).
 * `@fontsource` chỉ phát hành WOFF/WOFF2; FreeType trong sharp bỏ qua cả hai và lặng lẽ dùng font
 * hệ thống. WOFF 1.0 chỉ là các bảng SFNT nén zlib từng bảng, nên giải nén bằng `node:zlib` là đủ,
 * không cần dependency. WOFF2 (brotli + biến đổi bảng glyf) không hỗ trợ.
 *
 * Đặc tả: https://www.w3.org/TR/WOFF/
 */
export function woffToSfnt(woff: Buffer): Buffer {
  if (woff.length < 44 || woff.toString('latin1', 0, 4) !== 'wOFF') {
    throw new Error('Không phải font WOFF 1.0 (thiếu chữ ký wOFF)');
  }
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const totalSfntSize = woff.readUInt32BE(16);
  // Chặn zip bomb: font hợp lệ của site chỉ vài trăm KB.
  if (totalSfntSize > MAX_SFNT_SIZE) {
    throw new Error(`WOFF quá lớn: ${totalSfntSize} byte (tối đa ${MAX_SFNT_SIZE})`);
  }
  if (numTables === 0 || 44 + numTables * 20 > woff.length) {
    throw new Error('WOFF hỏng: bảng mục lục vượt quá độ dài file');
  }

  const tables = Array.from({ length: numTables }, (_, i) => {
    const entry = 44 + i * 20;
    const tag = woff.toString('latin1', entry, entry + 4);
    const offset = woff.readUInt32BE(entry + 4);
    const compLength = woff.readUInt32BE(entry + 8);
    const origLength = woff.readUInt32BE(entry + 12);
    const checksum = woff.readUInt32BE(entry + 16);
    if (offset + compLength > woff.length) {
      throw new Error(`WOFF hỏng: bảng ${tag} vượt quá độ dài file`);
    }
    const raw = woff.subarray(offset, offset + compLength);
    if (origLength > totalSfntSize) {
      throw new Error(`WOFF hỏng: bảng ${tag} lớn hơn totalSfntSize`);
    }
    // maxOutputLength: zlib dừng ngay khi vượt độ dài khai báo, không nở hết rồi mới kiểm tra.
    const data = compLength < origLength ? inflateSync(raw, { maxOutputLength: origLength }) : raw;
    if (data.length !== origLength) {
      throw new Error(`WOFF hỏng: bảng ${tag} giải nén sai độ dài`);
    }
    return { tag, checksum, data };
  });

  // Offset table (12 byte) + table record (16 byte/bảng); dữ liệu mỗi bảng căn 4 byte.
  const pad4 = (n: number) => (n + 3) & ~3;
  const headerSize = 12 + numTables * 16;
  const total = tables.reduce((sum, t) => sum + pad4(t.data.length), headerSize);
  if (total !== totalSfntSize) {
    throw new Error('WOFF hỏng: tổng kích thước bảng không khớp totalSfntSize');
  }
  const out = Buffer.alloc(total);

  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(numTables * 16 - searchRange, 10);

  // Mục lục WOFF đã sắp theo tag (bắt buộc theo đặc tả), giữ nguyên thứ tự.
  let offset = headerSize;
  tables.forEach((t, i) => {
    const record = 12 + i * 16;
    out.write(t.tag, record, 'latin1');
    out.writeUInt32BE(t.checksum, record + 4);
    out.writeUInt32BE(offset, record + 8);
    out.writeUInt32BE(t.data.length, record + 12);
    t.data.copy(out, offset);
    offset += pad4(t.data.length);
  });
  return out;
}
