import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY } from './scripts/theme-toggle';

const source = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');

interface Env {
  /** Giá trị đã lưu; `'throw'` giả lập localStorage bị chặn. */
  saved?: string | null | 'throw';
  prefersLight?: boolean;
  /** Trình duyệt không có matchMedia. */
  noMatchMedia?: boolean;
}

/** Chạy theme-init.js trong sandbox với trình duyệt giả, trả về các thuộc tính được gắn lên <html>. */
function runAll({
  saved = null,
  prefersLight = false,
  noMatchMedia = false,
}: Env): Record<string, string> {
  const attributes: Record<string, string> = {};
  const context: Record<string, unknown> = {
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
    },
    localStorage: {
      getItem: (key: string) => {
        if (saved === 'throw') throw new Error('SecurityError');
        // Cùng khóa với nút chuyển theme, nếu lệch thì lựa chọn đã lưu bị bỏ qua.
        return key === THEME_STORAGE_KEY ? saved : null;
      },
    },
  };
  if (!noMatchMedia) {
    context.matchMedia = (query: string) => ({
      matches: query === '(prefers-color-scheme: light)' && prefersLight,
    });
  }
  runInNewContext(source, context);
  return attributes;
}

/** data-theme được đặt lên <html>. */
const run = (env: Env): string | undefined => runAll(env)['data-theme'];

describe('theme-init.js', () => {
  it('ưu tiên lựa chọn đã lưu hơn hệ điều hành', () => {
    expect(run({ saved: 'light', prefersLight: false })).toBe('light');
    expect(run({ saved: 'dark', prefersLight: true })).toBe('dark');
  });

  it('theo prefers-color-scheme khi chưa lưu', () => {
    expect(run({ prefersLight: true })).toBe('light');
    expect(run({ prefersLight: false })).toBe('dark');
  });

  it('bỏ qua giá trị đã lưu không hợp lệ', () => {
    expect(run({ saved: 'red', prefersLight: true })).toBe('light');
    expect(run({ saved: '"><script>', prefersLight: false })).toBe('dark');
  });

  it('localStorage ném lỗi thì vẫn theo hệ điều hành', () => {
    expect(run({ saved: 'throw', prefersLight: true })).toBe('light');
    expect(run({ saved: 'throw' })).toBe('dark');
  });

  it('mặc định tối khi không có matchMedia', () => {
    expect(run({ noMatchMedia: true })).toBe('dark');
  });

  it.each<[string, Env]>([
    ['đã lưu', { saved: 'light' }],
    ['theo hệ điều hành', { prefersLight: true }],
    ['localStorage ném lỗi', { saved: 'throw' }],
    ['không có matchMedia', { noMatchMedia: true }],
  ])('luôn gắn data-js để hiện nút chuyển theme (%s)', (_name, env) => {
    expect(runAll(env)).toHaveProperty('data-js', '');
  });
});
