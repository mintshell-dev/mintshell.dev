import base from '../tokens/base.json' with { type: 'json' };
import dark from '../tokens/theme.dark.json' with { type: 'json' };
import light from '../tokens/theme.light.json' with { type: 'json' };

/** Một nhóm hoặc một token theo W3C Design Tokens (`$type` kế thừa từ nhóm cha). */
export interface TokenNode {
  $type?: string;
  $value?: unknown;
  [key: string]: unknown;
}

export interface FlatToken {
  path: string[];
  type: string | undefined;
  value: string;
}

export const sources = { base, dark, light } as const;

const HEADER = 'Tự sinh từ packages/tokens/tokens/*.json bởi src/build.ts. Không sửa tay.';

/**
 * Allowlist giá trị theo `$type`. Giá trị token đi thẳng vào CSS, nên mọi thứ ngoài
 * allowlist (ví dụ `url()`, `@import`, `;`, `}`) đều bị từ chối và build báo lỗi.
 */
const PATTERNS: Record<string, RegExp> = {
  color: /^#[0-9A-Fa-f]{6}$/,
  dimension: /^\d+(\.\d+)?(px|rem|em)$/,
  duration: /^\d+ms$/,
};
const FONT_NAME = /^[A-Za-z0-9 -]+$/;
const KEY = /^[A-Za-z0-9]+$/;

function invalid(path: string[], value: unknown): Error {
  return new Error(`Token ${path.join('.')} có giá trị không hợp lệ: ${JSON.stringify(value)}`);
}

/** Kiểm tra theo allowlist rồi định dạng giá trị thành chuỗi CSS. */
export function formatValue(path: string[], type: string | undefined, value: unknown): string {
  switch (type) {
    case 'color':
    case 'dimension':
    case 'duration':
      if (typeof value === 'string' && PATTERNS[type]?.test(value)) {
        return value;
      }
      throw invalid(path, value);
    case 'fontWeight':
      if (Number.isInteger(value) && (value as number) >= 100 && (value as number) <= 900) {
        return String(value);
      }
      throw invalid(path, value);
    case 'fontFamily':
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((name) => typeof name === 'string' && FONT_NAME.test(name))
      ) {
        return value.map((name: string) => (name.includes(' ') ? `"${name}"` : name)).join(', ');
      }
      throw invalid(path, value);
    default:
      throw new Error(`Token ${path.join('.')} có $type không được hỗ trợ: ${String(type)}`);
  }
}

/** Chỉ cho phép khóa chữ và số, để tên biến CSS không chứa ký tự đặc biệt. */
function childEntries(node: TokenNode, path: string[]): [string, TokenNode][] {
  return Object.entries(node)
    .filter(([key]) => !key.startsWith('$'))
    .map(([key, child]) => {
      if (!KEY.test(key)) {
        throw new Error(`Tên khóa không hợp lệ: ${[...path, key].join('.')}`);
      }
      return [key, child as TokenNode];
    });
}

/** Làm phẳng cây token thành danh sách theo thứ tự khai báo. */
export function flatten(node: TokenNode, path: string[] = [], inheritedType?: string): FlatToken[] {
  const type = node.$type ?? inheritedType;
  if ('$value' in node) {
    return [{ path, type, value: formatValue(path, type, node.$value) }];
  }
  return childEntries(node, path).flatMap(([key, child]) => flatten(child, [...path, key], type));
}

const kebab = (segment: string): string => segment.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** `['color', 'onAccent']` → `--color-on-accent` */
export function cssVarName(path: string[]): string {
  return `--${path.map(kebab).join('-')}`;
}

const declarations = (tokens: FlatToken[]): string[] =>
  tokens.map((t) => `  ${cssVarName(t.path)}: ${t.value};`);

export function generateCss(): string {
  const baseTokens = flatten(base);
  const durations = baseTokens.filter((t) => t.type === 'duration');
  return [
    `/* ${HEADER} */`,
    '',
    '/* Mặc định: theme tối. */',
    ':root {',
    '  color-scheme: dark;',
    ...declarations(baseTokens),
    ...declarations(flatten(dark)),
    '}',
    '',
    '[data-theme="light"] {',
    '  color-scheme: light;',
    ...declarations(flatten(light)),
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  :root {',
    ...durations.map((t) => `    ${cssVarName(t.path)}: 0ms;`),
    '  }',
    '}',
    '',
  ].join('\n');
}

/** Bỏ `$type`/`$value`, chỉ giữ giá trị đã định dạng như trong CSS. */
function resolve(node: TokenNode, path: string[] = [], inheritedType?: string): unknown {
  const type = node.$type ?? inheritedType;
  if ('$value' in node) {
    return formatValue(path, type, node.$value);
  }
  return Object.fromEntries(
    childEntries(node, path).map(([key, child]) => [key, resolve(child, [...path, key], type)]),
  );
}

/** Hằng số TypeScript dùng chung ngoài CSS (ví dụ video Remotion). */
export function generateTs(): string {
  const value = {
    ...(resolve(base) as object),
    theme: { dark: resolve(dark), light: resolve(light) },
  };
  return [
    `// ${HEADER}`,
    '',
    `export const tokens = ${JSON.stringify(value, null, 2)} as const;`,
    '',
    'export type Theme = keyof typeof tokens.theme;',
    '',
  ].join('\n');
}
