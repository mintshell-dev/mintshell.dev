import { describe, expect, it } from 'vitest';

import { ui, useTranslations } from './dictionary.ts';
import { locales } from './locales.ts';

describe('từ điển giao diện', () => {
  it('có đủ mọi ngôn ngữ được hỗ trợ', () => {
    expect(Object.keys(ui).sort()).toEqual([...locales].sort());
  });

  it('vi và en có cùng tập khóa', () => {
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.vi).sort());
  });

  it.each(locales)('%s không có chuỗi rỗng', (locale) => {
    for (const [key, value] of Object.entries(ui[locale])) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('useTranslations trả chuỗi theo ngôn ngữ', () => {
    expect(useTranslations('vi')('skipLink')).toBe('Bỏ qua tới nội dung');
    expect(useTranslations('en')('skipLink')).toBe('Skip to content');
  });
});
