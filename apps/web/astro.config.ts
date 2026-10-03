import { defineConfig } from 'astro/config';

import { defaultLocale, locales } from './src/i18n';

export default defineConfig({
  site: 'https://mintshell.dev',
  // astro dev mặc định chỉ nghe [::1]; cổng chuyển tiếp của VS Code dùng IPv4.
  // Chỉ nghe loopback, không mở dev server ra mạng ngoài.
  server: { host: '127.0.0.1' },
  i18n: {
    locales: [...locales],
    defaultLocale,
    routing: {
      prefixDefaultLocale: false,
    },
  },
  // URL không có `/` cuối: /writeups, /en, /en/writeups (ADR 0007).
  trailingSlash: 'never',
  build: {
    // writeups.html thay vì writeups/index.html, để Cloudflare Pages không 308 sang /writeups/.
    format: 'file',
    // Luôn xuất CSS thành file, không nhúng <style>, để CSP không cần style-src 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Không nhúng tài nguyên nhỏ thành data: URI, để CSP giữ được font-src/img-src 'self'.
      assetsInlineLimit: 0,
    },
  },
});
