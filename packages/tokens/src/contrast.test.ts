import { describe, expect, it } from 'vitest';

import { contrastRatio, relativeLuminance } from './contrast.ts';

describe('contrastRatio', () => {
  it('trắng và đen là 21:1', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('không phụ thuộc thứ tự tham số', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('cùng màu là 1:1', () => {
    expect(contrastRatio('#3DDC97', '#3DDC97')).toBe(1);
  });

  it('khớp giá trị tham chiếu #777777 trên trắng ≈ 4.48', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('từ chối màu không đúng dạng #RRGGBB', () => {
    expect(() => relativeLuminance('#FFF')).toThrow();
  });
});
