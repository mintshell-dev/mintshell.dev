import { defineConfig } from 'vitest/config';

/**
 * Kiểm tra bản build (`apps/web/dist`), tách khỏi unit test: chạy bằng `pnpm test:dist`
 * sau `build`. File `*.check.ts` không khớp mẫu mặc định nên `vitest run` ở gốc không nhặt.
 */
export default defineConfig({
  test: {
    include: ['test-dist/**/*.check.ts'],
    globalSetup: ['test-dist/setup.ts'],
  },
});
