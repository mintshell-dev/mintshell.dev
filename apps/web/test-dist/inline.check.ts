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

  // Phủ cả output MDX: nội dung bài là dữ liệu, không được sinh handler/thẻ thực thi.
  // Tầng build là phòng tuyến trước; CSP 'self' ở M5 là phòng tuyến hai (ADR 0009).
  // Chỉ bắt handler trong THẺ THẬT (`<tag … onX=…>`): chuỗi "onerror=" dạng text đã escape
  // trong khối code (`&lt;img onerror=…&gt;`) là nội dung hợp lệ của write-up về XSS, không match.
  it.each(html)('$path: không có event handler on*= trong thẻ thật', ({ content }) => {
    const handler = /<[a-z][a-z0-9]*\b[^>]*?\son[a-z]+\s*=/i.exec(content);
    expect(handler, `handler nội tuyến: ${handler?.[0]}`).toBeNull();
  });

  // Thẻ nguy hiểm dạng thật (escaped `&lt;iframe` trong code là text hợp lệ, không match).
  it.each(html)('$path: không có thẻ nguy hiểm (iframe/object/embed/form)', ({ content }) => {
    expect(content).not.toMatch(/<(?:iframe|object|embed|form)\b/i);
  });
});
