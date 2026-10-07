import type { Locale } from '@mintshell/shared';

/** Phần frontmatter ảnh hưởng tới việc có hiện ở danh sách công khai hay không. */
export interface ListingData {
  fixture?: boolean;
  draft: boolean;
  translation: 'done' | 'pending';
}

/**
 * Bài có hiện ở danh sách công khai (`/writeups`, `/en/writeups`, trang chủ, prev/next) của một ngôn ngữ.
 * Mỗi trang chỉ liệt kê bài có bản của ngôn ngữ đó thật: `translation: done` (vi và en đều vậy), không
 * fixture, và không draft (trừ khi `dev`, để xem thử). `locale` chưa dùng nhưng giữ trong chữ ký vì quy tắc
 * là theo từng bản ngôn ngữ (mỗi `<slug>/<locale>.mdx` có `translation` riêng).
 */
export function isListed(data: ListingData, _locale: Locale, dev: boolean): boolean {
  if (data.fixture) return false;
  if (data.draft && !dev) return false;
  return data.translation === 'done';
}
