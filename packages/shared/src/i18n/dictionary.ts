import type { Locale } from './locales.ts';

/** Chuỗi giao diện tiếng Việt; tập khóa của mọi ngôn ngữ khác phải trùng với bản này. */
const vi = {
  'site.description': 'Write-up CTF, cheatsheet và ghi chép về pentest ứng dụng web.',
  skipLink: 'Bỏ qua tới nội dung',
  'nav.label': 'Điều hướng chính',
  'nav.home': 'mintshell — trang chủ',
  'nav.writeups': 'write-ups',
  'nav.cheatsheets': 'cheatsheets',
  'nav.portfolio': 'portfolio',
  'lang.short': 'EN',
  'lang.switchLabel': 'Read in English',
  'theme.toggle': 'Chuyển giao diện sáng/tối',
  'theme.toLight': 'Chuyển sang giao diện sáng',
  'theme.toDark': 'Chuyển sang giao diện tối',
  'footer.license': 'Giấy phép',
  'footer.code': 'mã nguồn',
  'footer.content': 'nội dung',
  'home.title': 'Xin chào',
  'construction.title': 'Đang xây dựng',
  'construction.body': 'Trang này đang được xây dựng. Hãy quay lại sau nhé.',
  'notFound.title': 'Không tìm thấy trang',
  'notFound.body': 'Trang bạn tìm không tồn tại hoặc đã bị chuyển đi.',
  'notFound.home': 'Về trang chủ',
} as const;

export type UiKey = keyof typeof vi;

const en: Record<UiKey, string> = {
  'site.description': 'CTF write-ups, cheatsheets and notes on web application pentesting.',
  skipLink: 'Skip to content',
  'nav.label': 'Main navigation',
  'nav.home': 'mintshell — home',
  'nav.writeups': 'write-ups',
  'nav.cheatsheets': 'cheatsheets',
  'nav.portfolio': 'portfolio',
  'lang.short': 'VI',
  'lang.switchLabel': 'Đọc bằng tiếng Việt',
  'theme.toggle': 'Toggle light/dark theme',
  'theme.toLight': 'Switch to light theme',
  'theme.toDark': 'Switch to dark theme',
  'footer.license': 'License',
  'footer.code': 'code',
  'footer.content': 'content',
  'home.title': 'Hello',
  'construction.title': 'Under construction',
  'construction.body': 'This page is under construction. Please check back later.',
  'notFound.title': 'Page not found',
  'notFound.body': 'The page you are looking for does not exist or has moved.',
  'notFound.home': 'Back to home',
};

export const ui: Record<Locale, Record<UiKey, string>> = { vi, en };

/** Hàm tra chuỗi giao diện theo ngôn ngữ. */
export function useTranslations(locale: Locale): (key: UiKey) => string {
  return (key) => ui[locale][key];
}
