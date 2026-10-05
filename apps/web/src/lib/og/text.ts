/** Hàm thuần dùng khi dựng chữ cho ảnh OG (ADR 0012); không phụ thuộc sharp để test nhanh. */

/**
 * Escape chuỗi trước khi đưa vào Pango markup. Tiêu đề/tag đến từ frontmatter: không escape thì
 * `<` hay `&` làm hỏng markup (render lỗi) hoặc chèn được thẻ định dạng Pango.
 */
export function escapeMarkup(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Bỏ ký tự điều khiển (C0, DEL, C1) và ký tự định dạng vô hình (bidi override U+202E,
 * zero-width…) rồi gộp khoảng trắng: không để chúng đảo chiều hay giấu chữ trên ảnh.
 */
export function cleanText(text: string): string {
  return text
    .replace(/\p{Cf}/gu, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Giữ `count` từ đầu và thêm `…` nếu bị cắt. */
export function truncateWords(text: string, count: number): string {
  const words = text.split(' ');
  if (count >= words.length) return text;
  return `${words
    .slice(0, Math.max(1, count))
    .join(' ')
    .replace(/[\s,.:;—-]+$/, '')}…`;
}
