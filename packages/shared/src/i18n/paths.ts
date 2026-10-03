import { defaultLocale, type Locale } from './locales.ts';

/** `/en` hoặc `/en/...`, không khớp `/english`. */
const EN_PREFIX = /^\/en(?=\/|$)/;

/**
 * Chuẩn hoá pathname: luôn bắt đầu bằng đúng một `/` (chặn `//host` thành URL
 * protocol-relative), không có `/` cuối trừ trang gốc, bỏ đuôi `.html` và `/index`
 * (khi build với `format: 'file'`, `Astro.url.pathname` là `/writeups.html`) (ADR 0007).
 */
function normalize(path: string): string {
  const trimmed = path
    // Trình duyệt bỏ tab/CR/LF và hiểu `\` như `/`: `/\host` cũng là protocol-relative.
    .replace(/[\t\n\r]/g, '')
    .replace(/\\/g, '/')
    .replace(/\.html$/, '')
    .replace(/(^|\/)index$/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  return `/${trimmed}`;
}

/** Ngôn ngữ của một pathname: `/en`, `/en/...` là `en`, còn lại là `vi`. */
export function localeFromPath(path: string): Locale {
  return EN_PREFIX.test(normalize(path)) ? 'en' : defaultLocale;
}

/** Bỏ tiền tố ngôn ngữ, trả về path dùng chung slug: `/en/writeups` → `/writeups`. */
export function stripLocale(path: string): string {
  return normalize(normalize(path).replace(EN_PREFIX, ''));
}

/** Path tương ứng ở ngôn ngữ `locale` (slug chung, ADR 0004): `/x` ↔ `/en/x`, `/` ↔ `/en`. */
export function localizePath(path: string, locale: Locale): string {
  const base = stripLocale(path);
  if (locale === defaultLocale) return base;
  return base === '/' ? `/${locale}` : `/${locale}${base}`;
}
