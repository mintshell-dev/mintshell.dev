import { describe, expect, it } from 'vitest';

import { defaultLocale, locales } from './i18n';

describe('i18n', () => {
  it('dùng tiếng Việt làm ngôn ngữ mặc định', () => {
    expect(defaultLocale).toBe('vi');
  });

  it('hỗ trợ đúng vi và en', () => {
    expect(locales).toEqual(['vi', 'en']);
  });
});
