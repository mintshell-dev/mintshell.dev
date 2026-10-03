import { describe, expect, it } from 'vitest';

import {
  cssVarName,
  flatten,
  generateCss,
  generateTs,
  sources,
  type TokenNode,
} from './generate.ts';

/** Lấy nội dung một khối CSS bắt đầu bằng `selector {`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `thiếu khối ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('cssVarName', () => {
  it('nối path bằng gạch ngang và chuyển camelCase sang kebab-case', () => {
    expect(cssVarName(['color', 'onAccent'])).toBe('--color-on-accent');
    expect(cssVarName(['motion', 'duration', 'fast'])).toBe('--motion-duration-fast');
  });
});

describe('flatten', () => {
  it('kế thừa $type từ nhóm cha', () => {
    expect(flatten(sources.base).find((t) => t.path.join('.') === 'space.1')).toEqual({
      path: ['space', '1'],
      type: 'dimension',
      value: '4px',
    });
  });

  it('định dạng fontFamily thành chuỗi CSS', () => {
    const sans = flatten(sources.base).find((t) => t.path.join('.') === 'font.sans');
    expect(sans?.value).toBe('"Be Vietnam Pro", system-ui, sans-serif');
  });
});

describe('kiểm tra giá trị theo allowlist', () => {
  const tree = (type: string, value: unknown): TokenNode => ({
    group: { $type: type, token: { $value: value } },
  });

  it.each([
    ['color', '#000; } body { background: url(https://evil.example/x) } :root {'],
    ['color', 'url(https://evil.example/x)'],
    ['color', 'red'],
    ['color', '#FFF'],
    ['dimension', '4px; @import url(https://evil.example/x.css)'],
    ['dimension', '4px}'],
    ['duration', '150ms; @import "https://evil.example/x.css"'],
    ['duration', '1s'],
    ['fontWeight', 450.5],
    ['fontWeight', 1000],
    ['fontWeight', '400'],
    ['fontFamily', ['Be Vietnam Pro", url(https://evil.example/x.woff2), "x']],
    ['fontFamily', ['x; @import url(https://evil.example/x.css)']],
    ['fontFamily', []],
    ['fontFamily', 'Be Vietnam Pro'],
    ['number', '1.5'],
    ['number', -1],
    ['number', Number.POSITIVE_INFINITY],
    ['cubicBezier', [0.1, 0.2, 0.3]],
    ['cubicBezier', [1.5, 0, 0.5, 1]],
    ['cubicBezier', [0, 0, 0.5, '1); } body { color: red']],
    ['cubicBezier', 'ease-out'],
  ])('%s từ chối %j', (type, value) => {
    expect(() => flatten(tree(type, value))).toThrow(/không hợp lệ/);
  });

  it('từ chối $type không có trong allowlist', () => {
    expect(() => flatten(tree('shadow', '0 0 1px red'))).toThrow(/không được hỗ trợ/);
    expect(() => flatten({ token: { $value: '#000000' } })).toThrow(/không được hỗ trợ/);
  });

  it('từ chối tên khóa có ký tự đặc biệt', () => {
    expect(() =>
      flatten({ color: { $type: 'color', 'bg: red; } * {': { $value: '#000000' } } }),
    ).toThrow(/Tên khóa không hợp lệ/);
  });

  it('chấp nhận giá trị hợp lệ', () => {
    expect(flatten(tree('dimension', '1.5rem'))[0]?.value).toBe('1.5rem');
    expect(flatten(tree('fontWeight', 600))[0]?.value).toBe('600');
    expect(flatten(tree('number', 1.35))[0]?.value).toBe('1.35');
    expect(flatten(tree('cubicBezier', [0.16, 1, 0.3, 1]))[0]?.value).toBe(
      'cubic-bezier(0.16, 1, 0.3, 1)',
    );
  });
});

describe('generateCss', () => {
  const css = generateCss();
  const root = block(css, ':root');
  const light = block(css, '[data-theme="light"]');

  it(':root có mọi token nền và màu theme tối', () => {
    for (const t of [...flatten(sources.base), ...flatten(sources.dark)]) {
      expect(root).toContain(`${cssVarName(t.path)}: ${t.value};`);
    }
    expect(root).toContain('color-scheme: dark;');
  });

  it('[data-theme="light"] có mọi màu theme sáng', () => {
    for (const t of flatten(sources.light)) {
      expect(light).toContain(`${cssVarName(t.path)}: ${t.value};`);
    }
    expect(light).toContain('color-scheme: light;');
  });

  it('có các biến bắt buộc', () => {
    for (const name of [
      '--color-bg',
      '--color-on-accent',
      '--severity-critical',
      '--font-sans',
      '--font-mono',
      '--space-4',
      '--radius-md',
      '--motion-duration-base',
    ]) {
      expect(root).toContain(`${name}:`);
    }
  });

  it('prefers-reduced-motion đưa mọi thời lượng về 0', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const durations = flatten(sources.base).filter((t) => t.type === 'duration');
    expect(durations).toHaveLength(4);
    for (const t of durations) {
      expect(reduced).toContain(`${cssVarName(t.path)}: 0ms;`);
    }
  });
});

describe('generateTs', () => {
  it('xuất hằng số tokens có cả hai theme', () => {
    const ts = generateTs();
    expect(ts).toContain('export const tokens = {');
    expect(ts).toContain('"onAccent": "#FFFFFF"');
    expect(ts).toMatch(/as const;\n/);
  });
});
