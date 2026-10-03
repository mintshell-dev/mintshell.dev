/** Khóa localStorage, phải trùng với public/theme-init.js. */
export const THEME_STORAGE_KEY = 'theme';

export type Theme = 'dark' | 'light';

export const otherTheme = (theme: Theme): Theme => (theme === 'dark' ? 'light' : 'dark');

/** Theme hiện tại trên <html>; theme-init.js đã đặt trước khi trang hiển thị. */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** aria-label mô tả hành động: đang tối thì "chuyển sang sáng" và ngược lại. */
function updateLabel(button: HTMLButtonElement, theme: Theme): void {
  const label = theme === 'dark' ? button.dataset.labelToLight : button.dataset.labelToDark;
  if (label) button.setAttribute('aria-label', label);
}

export function initThemeToggle(button: HTMLButtonElement): void {
  updateLabel(button, currentTheme());
  button.addEventListener('click', () => {
    const next = otherTheme(currentTheme());
    document.documentElement.dataset.theme = next;
    updateLabel(button, next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Không lưu được (chế độ riêng tư…): vẫn đổi theme cho phiên hiện tại.
    }
  });
}
