/**
 * Hình vẽ biểu tượng mintshell (vỏ ốc + `>_`), toạ độ gốc của `brand/`. Dùng chung cho
 * `BrandMark.astro` (SVG nội tuyến) và ảnh OG (`lib/og/render.ts`) để hai nơi không lệch nhau.
 */
export const brandShell =
  'M150 360 C140 220 230 120 330 126 C420 132 466 210 452 280 C440 340 384 372 316 370 L150 370 Z';
export const brandPrompt = '252,214 304,250 252,286';
export const brandCursor = { x1: 322, y1: 290, x2: 372, y2: 290 } as const;
/** Khung cắt sát hình vẽ (biến thể `mark`, không mắt). */
export const brandViewBox = { x: 126, y: 70, size: 354 } as const;
