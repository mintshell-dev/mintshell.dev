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
});
