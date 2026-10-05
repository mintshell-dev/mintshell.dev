import { describe, expect, it } from 'vitest';

import { attackChainSchema, criticalSteps, wrapText } from './mdx';

describe('wrapText', () => {
  it('ngắt theo từ, không dòng nào vượt maxChars', () => {
    const lines = wrapText('Chứng minh có thể đọc file tùy ý bằng quyền root.', 16);
    expect(lines).toEqual(['Chứng minh có', 'thể đọc file tùy', 'ý bằng quyền', 'root.']);
    for (const line of lines) expect([...line].length).toBeLessThanOrEqual(16);
  });

  it('cắt cứng từ dài hơn một dòng (đường dẫn API)', () => {
    expect(wrapText('GET /api/admin/export_db', 8)).toEqual([
      'GET',
      '/api/adm',
      'in/expor',
      't_db',
    ]);
  });

  it('chuẩn hoá NFC: chữ Việt dạng tổ hợp đếm như dạng dựng sẵn', () => {
    const nfd = 'kiểm tra'.normalize('NFD');
    expect(wrapText(nfd, 8)).toEqual(['kiểm tra']);
  });

  it('gộp khoảng trắng, chuỗi rỗng không sinh dòng', () => {
    expect(wrapText('  a   b  ', 10)).toEqual(['a b']);
    expect(wrapText('   ', 10)).toEqual([]);
  });

  it('từ chối maxChars < 1', () => {
    expect(() => wrapText('a', 0)).toThrow();
  });
});

describe('criticalSteps', () => {
  it('không đánh dấu thì bước cuối là critical', () => {
    expect([...criticalSteps([{}, {}, {}])]).toEqual([2]);
  });

  it('có đánh dấu thì chỉ các bước đó', () => {
    expect([...criticalSteps([{}, { critical: true }, {}])]).toEqual([1]);
  });
});

describe('attackChainSchema', () => {
  const step = { label: 'a', description: 'b' };

  it('nhận props hợp lệ', () => {
    expect(attackChainSchema.safeParse({ label: 'chuỗi', steps: [step] }).success).toBe(true);
  });

  it.each([
    ['thiếu label', { steps: [step] }],
    ['label rỗng', { label: '  ', steps: [step] }],
    ['không có bước', { label: 'x', steps: [] }],
    ['bước thiếu mô tả', { label: 'x', steps: [{ label: 'a' }] }],
    ['khóa lạ', { label: 'x', steps: [step], color: 'red' }],
  ])('từ chối: %s', (_name, props) => {
    expect(attackChainSchema.safeParse(props).success).toBe(false);
  });
});
