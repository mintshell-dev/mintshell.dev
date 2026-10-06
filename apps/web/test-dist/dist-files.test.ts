import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { isWriteupDir, publicSlugs } from './dist-files';

/**
 * `publicSlugs` (dùng trong test:dist) phải bỏ qua thư mục bắt đầu bằng `_` (vd. `_import/` của
 * `pnpm notion:pull`, ADR 0013) và `.`, giống collection Astro. Chạy trong `pnpm test`, không cần dist.
 */

const front = (extra = '') => `---\ntitle: "x"\n${extra}---\n\nnội dung\n`;

describe('isWriteupDir', () => {
  it('bỏ thư mục _ và . (nháp, thư mục tạm), giữ slug thường', () => {
    expect(isWriteupDir('valenfind')).toBe(true);
    expect(isWriteupDir('_import')).toBe(false);
    expect(isWriteupDir('_drafts')).toBe(false);
    expect(isWriteupDir('.tmp-x')).toBe(false);
  });
});

describe('publicSlugs bỏ qua thư mục _', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it('thư mục giả: _import/ (chỉ có vi.md, không có vi.mdx) và .tmp-* không làm lỗi, không thành slug', () => {
    const root = mkdtempSync(join(tmpdir(), 'public-slugs-'));
    cleanups.push(() => rmSync(root, { recursive: true, force: true }));
    const write = (path: string, body: string) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), body);
    };
    write('pub/vi.mdx', front());
    write('pub/en.mdx', front('translation: done\n'));
    write('nhap/vi.mdx', front('draft: true\n'));
    write('nhap/en.mdx', front('draft: true\n'));
    write('_import/tmp/vi.md', front());
    mkdirSync(join(root, '.tmp-x'));

    const dir = pathToFileURL(`${root}/`);
    expect(publicSlugs('vi', dir)).toEqual(['pub']);
    expect(publicSlugs('en', dir)).toEqual(['pub']);
  });

  it('content/writeups thật: có _import/<tmp>/vi.md vẫn chạy, không đụng nháp thật đang có', () => {
    const content = fileURLToPath(new URL('../../../content/writeups/', import.meta.url));
    const importDir = join(content, '_import');
    const hadImport = existsSync(importDir);
    const probe = join(importDir, `zz-test-${process.pid}`);
    mkdirSync(probe, { recursive: true });
    writeFileSync(join(probe, 'vi.md'), front());
    // Chỉ dọn đúng thứ test tạo ra; `_import/` có sẵn (nháp thật) thì giữ nguyên.
    cleanups.push(() => {
      rmSync(probe, { recursive: true, force: true });
      if (!hadImport) rmSync(importDir, { recursive: true, force: true });
    });

    for (const locale of ['vi', 'en'] as const) {
      const slugs = publicSlugs(locale);
      expect(slugs.some((s) => s.startsWith('_'))).toBe(false);
      expect(slugs).toContain('valenfind');
    }
  });
});
