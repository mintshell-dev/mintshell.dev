import { defineConfig } from 'astro/config';

import { defaultLocale, locales } from './src/i18n';

export default defineConfig({
  site: 'https://mintshell.dev',
  i18n: {
    locales: [...locales],
    defaultLocale,
    routing: {
      prefixDefaultLocale: false,
    },
  },
  build: {
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
