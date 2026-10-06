import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/', '**/.astro/', '**/.turbo/', '**/.wrangler/', '**/node_modules/'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    // Script tĩnh chạy thẳng trên trình duyệt, không qua bundler.
    files: ['apps/web/public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
        localStorage: 'readonly',
        matchMedia: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
      },
    },
  },
);
