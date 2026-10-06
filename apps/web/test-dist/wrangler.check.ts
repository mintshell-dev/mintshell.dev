import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `wrangler.toml` (ADR 0014): kiểm vài dòng quyết định cách phục vụ `dist` với `build.format: 'file'`
 * (ADR 0007). Không parse TOML đầy đủ: so khớp từng dòng `key = value` ở đầu dòng.
 */
const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const value = (key: string): string | undefined =>
  new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm').exec(toml)?.[1];

describe('wrangler.toml', () => {
  it('Worker chỉ có assets từ ./dist', () => {
    expect(value('name')).toBe('"mintshell"');
    expect(value('main')).toBeUndefined();
    expect(toml).toMatch(/^\[assets\]$/m);
    expect(value('directory')).toBe('"./dist"');
  });

  it('URL không / cuối, .html → không đuôi, 404 theo thư mục', () => {
    expect(value('html_handling')).toBe('"drop-trailing-slash"');
    expect(value('not_found_handling')).toBe('"404-page"');
  });

  it('directory nằm trong [assets]; không route, env, [site] hay chạy Worker trước assets', () => {
    expect(toml).toMatch(/^\[assets\]\n(?:[^[\n].*\n|\n)*?directory\s*=/m);
    expect(toml).not.toMatch(/^[ \t]*(?:routes?|run_worker_first|main)\s*=/m);
    expect(toml).not.toMatch(/^[ \t]*\[\[?(?:routes|env\b|site\b)/m);
    // Chỉ một bảng: [assets].
    expect(toml.match(/^[ \t]*\[/gm)).toEqual(['[']);
  });

  it('không mở workers.dev hay preview URL', () => {
    expect(value('workers_dev')).toBe('false');
    expect(value('preview_urls')).toBe('false');
  });
});
