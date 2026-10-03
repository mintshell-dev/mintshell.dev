import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/', '**/.astro/', '**/.turbo/', '**/node_modules/'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
);
