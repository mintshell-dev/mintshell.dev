import { describe, expect, it } from 'vitest';

import { attr, distFiles, tags } from './dist-files';

// CSP ở M5 chỉ cho 'self': không script/style nội tuyến, không data: URI (ADR 0006, ADR 0007).
const html = distFiles('.html');

describe('HTML không có mã nội tuyến', () => {
  it('có trang để kiểm tra', () => {
    expect(html.length).toBeGreaterThan(0);
  });

  it.each(html)('$path', ({ content }) => {
    for (const script of tags(content, 'script')) {
      expect(attr(script, 'src'), `script nội tuyến: ${script}`).toBeTruthy();
    }
    expect(content).not.toMatch(/<style\b/i);
    expect(content).not.toMatch(/\sstyle\s*=/i);
    expect(content).not.toMatch(/\s(?:src|href|srcset)\s*=\s*"\s*data:/i);
  });
});
