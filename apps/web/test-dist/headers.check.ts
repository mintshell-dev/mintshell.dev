import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { DIST, distFiles, readDist } from './dist-files';

/**
 * `dist/_headers` (nguồn: `public/_headers`, ADR 0014). Giá trị mong đợi viết lại độc lập ở đây,
 * không đọc từ file nguồn: sửa CSP thì phải sửa cả test.
 */
const BASE_CSP: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'none'"],
  'object-src': ["'none'"],
  'form-action': ["'self'"],
};

/** Chỉ các đường dẫn tìm kiếm Pagefind được nới WebAssembly (ADR 0010). */
const WASM_PATHS = ['/search', '/en/search', '/pagefind/*'];
const SEARCH_CSP: Record<string, string[]> = {
  ...BASE_CSP,
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'worker-src': ["'self'"],
};

/** Ảnh Open Graph phải tải được từ site ngoài (ADR 0012, 0014): chỉ thư mục này nới CORP. */
const OG_PATH = '/og/*';

interface Rule {
  path: string;
  /** Header đặt bởi luật (tên viết thường). */
  set: Map<string, string>;
  /** Header gỡ bằng `! Name`. */
  detach: Set<string>;
}

/** Parse cú pháp `_headers` của Cloudflare: dòng không thụt lề là đường dẫn, dòng thụt lề là header. */
function parseHeaders(source: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of source.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      rules.push({ path: raw.trim(), set: new Map(), detach: new Set() });
      continue;
    }
    const rule = rules.at(-1);
    if (!rule) throw new Error(`Header nằm ngoài luật: ${raw}`);
    const line = raw.trim();
    if (line.startsWith('!')) {
      rule.detach.add(line.slice(1).trim().toLowerCase());
      continue;
    }
    const colon = line.indexOf(':');
    if (colon <= 0) throw new Error(`Dòng header sai cú pháp: ${raw}`);
    const name = line.slice(0, colon).trim().toLowerCase();
    if (rule.set.has(name)) throw new Error(`Header ${name} lặp trong luật ${rule.path}`);
    rule.set.set(name, line.slice(colon + 1).trim());
  }
  return rules;
}

/** CSP → map chỉ thị (tên viết thường) → danh sách nguồn. Chỉ thị lặp làm test fail. */
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (!name) continue;
    const key = name.toLowerCase();
    if (key in out) throw new Error(`Chỉ thị CSP lặp: ${key}`);
    out[key] = sources;
  }
  return out;
}

const rules = parseHeaders(readDist('_headers'));
const rule = (path: string): Rule => {
  const found = rules.find((r) => r.path === path);
  if (!found) throw new Error(`_headers thiếu luật ${path}`);
  return found;
};
const csp = (r: Rule): Record<string, string[]> =>
  parseCsp(r.set.get('content-security-policy') ?? '');

describe('_headers', () => {
  it('chỉ có luật /*, các luật tìm kiếm và /og/*, không trùng đường dẫn', () => {
    expect(rules.map((r) => r.path).sort()).toEqual(['/*', ...WASM_PATHS, OG_PATH].sort());
  });

  it('/*: CSP đúng tập chỉ thị chặt', () => {
    expect(csp(rule('/*'))).toEqual(BASE_CSP);
  });

  it.each(WASM_PATHS)('%s: gỡ CSP chung, đặt CSP chung + wasm + worker-src', (path) => {
    const r = rule(path);
    // Không gỡ thì Cloudflare nối hai CSP thành hai policy; bản không wasm thắng và chặn Pagefind.
    expect(r.detach).toEqual(new Set(['content-security-policy']));
    expect(csp(r)).toEqual(SEARCH_CSP);
    expect([...r.set.keys()]).toEqual(['content-security-policy']);
  });

  it('/og/*: chỉ gỡ CORP chung và đặt CORP cross-origin (site ngoài tải được ảnh chia sẻ)', () => {
    const r = rule(OG_PATH);
    // Không gỡ thì Cloudflare nối thành "same-origin, cross-origin" (giá trị không hợp lệ).
    expect(r.detach).toEqual(new Set(['cross-origin-resource-policy']));
    expect([...r.set.entries()]).toEqual([['cross-origin-resource-policy', 'cross-origin']]);
  });

  it('CORP: cross-origin chỉ ở /og/*, mọi nơi khác same-origin', () => {
    expect(rule('/*').set.get('cross-origin-resource-policy')).toBe('same-origin');
    for (const r of rules.filter((x) => x.path !== OG_PATH)) {
      expect(r.detach.has('cross-origin-resource-policy'), r.path).toBe(false);
      const corp = r.set.get('cross-origin-resource-policy');
      if (r.path !== '/*') expect(corp, r.path).toBeUndefined();
    }
  });

  it('dist/og chỉ chứa ảnh OG (không có gì khác nhận CORP cross-origin)', () => {
    const files = readdirSync(new URL('og/', DIST), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) expect(name).toMatch(/\.png$/);
  });

  it('không unsafe-inline/unsafe-eval; wasm-unsafe-eval chỉ ở luật tìm kiếm', () => {
    for (const r of rules) {
      for (const value of r.set.values()) {
        expect(value, r.path).not.toMatch(/'unsafe-(?:inline|eval|hashes)'/i);
        if (!WASM_PATHS.includes(r.path)) expect(value, r.path).not.toMatch(/wasm-unsafe-eval/i);
      }
    }
  });

  it('CSP không cho nguồn ngoài origin (không host, scheme hay wildcard)', () => {
    for (const r of rules.filter((x) => x.set.has('content-security-policy'))) {
      for (const sources of Object.values(csp(r))) {
        for (const s of sources) expect(s, r.path).toMatch(/^(?:'[a-z-]+'|data:)$/);
      }
    }
    // data: chỉ cho ảnh.
    for (const r of rules.filter((x) => x.set.has('content-security-policy'))) {
      const withData = Object.entries(csp(r)).filter(([, s]) => s.includes('data:'));
      expect(withData.map(([d]) => d)).toEqual(['img-src']);
    }
  });

  it('/*: đúng tập header, không gỡ gì (không lọt CORS, CSP Report-Only…)', () => {
    const r = rule('/*');
    expect([...r.set.keys()].sort()).toEqual(
      [
        'content-security-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy',
        'permissions-policy',
        'referrer-policy',
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
      ].sort(),
    );
    expect(r.detach.size).toBe(0);
  });

  it('/*: security headers khác', () => {
    const h = rule('/*').set;
    expect(h.get('x-content-type-options')).toBe('nosniff');
    expect(h.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(h.get('cross-origin-resource-policy')).toBe('same-origin');

    const hsts = h.get('strict-transport-security') ?? '';
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toMatch(/;\s*includeSubDomains\b/);

    const permissions = h.get('permissions-policy') ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(permissions).toMatch(new RegExp(`(?:^|,\\s*)${feature}=\\(\\)`));
    }
    // Không cấp quyền cho origin nào: mọi mục đều là danh sách rỗng.
    for (const item of permissions.split(',')) expect(item.trim()).toMatch(/^[a-z-]+=\(\)$/);
  });
});

describe('chỉ trang tìm kiếm cần wasm', () => {
  // Trang nào nạp Pagefind mà không nằm trong luật wasm thì tìm kiếm sẽ bị CSP chặn.
  it('chỉ bundle của trang tìm kiếm tham chiếu /pagefind/pagefind.js', () => {
    const users = distFiles('.js')
      .filter((f) => !f.path.startsWith('pagefind/'))
      .filter((f) => f.content.includes('/pagefind/pagefind.js'))
      .map((f) => f.path);
    expect(users.length).toBeGreaterThan(0);

    const pages = distFiles('.html')
      .filter((page) => users.some((js) => page.content.includes(`/${js}`)))
      .map((page) => page.path)
      .sort();
    expect(pages).toEqual(['en/search.html', 'search.html']);
  });
});
