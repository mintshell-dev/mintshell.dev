import { describe, expect, it } from 'vitest';

import { distFiles } from './dist-files';

// CSP font-src/style-src 'self': CSS chỉ được tham chiếu tài nguyên cùng origin.
const css = distFiles('.css');

describe('CSS chỉ dùng tài nguyên cùng origin', () => {
  it('có file CSS để kiểm tra', () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it.each(css)('$path', ({ content }) => {
    expect(content).not.toMatch(/data:/i);
    expect(content).not.toMatch(/@import/i);
    const urls = [...content.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((m) => m[1]);
    for (const url of urls) {
      expect(url, `URL ra ngoài: ${url}`).not.toMatch(/^(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/i);
    }
  });
});
