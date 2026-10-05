import { describe, expect, it } from 'vitest';

import { cleanText, escapeMarkup, truncateWords } from './text';

describe('escapeMarkup', () => {
  it('escape mọi ký tự đặc biệt của Pango markup', () => {
    expect(escapeMarkup(`<span foreground="red">a & b's</span>`)).toBe(
      '&lt;span foreground=&quot;red&quot;&gt;a &amp; b&apos;s&lt;/span&gt;',
    );
  });

  it('escape & trước để không escape hai lần', () => {
    expect(escapeMarkup('&lt;')).toBe('&amp;lt;');
  });

  it('giữ nguyên chữ Việt', () => {
    expect(escapeMarkup('đọc file bằng quyền root')).toBe('đọc file bằng quyền root');
  });
});

describe('cleanText', () => {
  it('bỏ ký tự điều khiển và gộp khoảng trắng', () => {
    expect(cleanText(' a\u0000b\n\tc\u007f ')).toBe('a b c');
  });

  it('bỏ ký tự định dạng vô hình (bidi override, zero-width)', () => {
    expect(cleanText('ab\u202Edc\u200Be\uFEFF')).toBe('abdce');
  });
});

describe('truncateWords', () => {
  it('không cắt khi đủ chỗ', () => {
    expect(truncateWords('một hai ba', 3)).toBe('một hai ba');
  });

  it('cắt và thêm …, bỏ dấu câu cuối', () => {
    expect(truncateWords('một, hai ba', 1)).toBe('một…');
  });
});
