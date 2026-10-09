/**
 * Một nguồn duy nhất cho "flag đã che": `test:dist` (`apps/web/test-dist/writeups.check.ts`) và bản quét của
 * `pnpm notion:pull` (`scripts/notion/scan.ts`) cùng dùng hàm này, để nháp và trang build không lệch nhau.
 */

/** Ký tự bao quanh từ "redacted" được coi là cách che: khoảng trắng, ngoặc, gạch dưới, gạch ngang, sao. */
const WRAP = String.raw`[\s\[\]<>(){}_*-]*`;
const REDACTED_FLAG = new RegExp(`^${WRAP}redacted${WRAP}$`, 'i');

/**
 * Nội dung trong `THM{…}`/`HTB{…}` (đã giải mã HTML entity / bỏ escape Markdown) có phải placeholder đã che
 * không: đúng từ `redacted` (không phân biệt hoa thường), tùy chọn bao bởi ngoặc/gạch dưới/gạch ngang, vd.
 * `redacted`, `[REDACTED]`, `<redacted>`, `__redacted__`, `-redacted-`. Có thêm bất kỳ ký tự nào khác (chuỗi
 * hex, `redacted_a1b2`) thì KHÔNG coi là đã che.
 */
export const isRedactedFlag = (inner: string): boolean => REDACTED_FLAG.test(inner.trim());
