import { describe, expect, it } from 'vitest';

import { readDist, SITE } from './dist-files';

/** `/.well-known/security.txt` theo RFC 9116 (ADR 0014). */
const DAY = 86_400_000;
const source = readDist('.well-known/security.txt');

/** Trường → các giá trị; bỏ dòng comment. */
const fields = new Map<string, string[]>();
for (const line of source.split('\n')) {
  if (line.trim() === '' || line.startsWith('#')) continue;
  const match = /^([A-Za-z-]+):\s*(\S.*)$/.exec(line);
  if (!match?.[1] || !match[2]) throw new Error(`Dòng sai cú pháp: ${line}`);
  const name = match[1].toLowerCase();
  fields.set(name, [...(fields.get(name) ?? []), match[2].trim()]);
}

describe('security.txt', () => {
  it('Contact là email liên hệ của site', () => {
    expect(fields.get('contact')).toEqual(['mailto:hi@mintshell.dev']);
  });

  it('có đúng một Expires, ISO 8601, chưa hết hạn và không quá 1 năm', () => {
    const expires = fields.get('expires') ?? [];
    expect(expires).toHaveLength(1);
    const value = expires[0] ?? '';
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
    const left = Date.parse(value) - Date.now();
    // Còn dưới 30 ngày thì fail để nhắc gia hạn (sửa Expires trong public/.well-known/security.txt).
    expect(left, `Expires ${value} sắp/đã hết hạn: gia hạn security.txt`).toBeGreaterThan(30 * DAY);
    expect(left, 'RFC 9116 khuyên Expires không quá 1 năm').toBeLessThanOrEqual(366 * DAY);
  });

  it('Preferred-Languages và Canonical', () => {
    expect(fields.get('preferred-languages')).toEqual(['vi, en']);
    expect(fields.get('canonical')).toEqual([`${SITE}/.well-known/security.txt`]);
  });

  it('chỉ có trường RFC 9116 đã biết, không URI giả', () => {
    const known = [
      'acknowledgments',
      'canonical',
      'contact',
      'encryption',
      'expires',
      'hiring',
      'policy',
      'preferred-languages',
    ];
    for (const name of fields.keys()) expect(known).toContain(name);
    for (const uri of fields.get('encryption') ?? []) expect(uri).toMatch(/^https:\/\//);
  });
});
