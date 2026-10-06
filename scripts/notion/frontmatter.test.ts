import { describe, expect, it } from 'vitest';

import * as site from '../../apps/web/src/schemas/writeup.ts';
import {
  buildFrontmatter,
  DIFFICULTIES,
  MISSING_DESCRIPTION,
  PLATFORMS,
  readList,
  SLUG_RE,
  TITLE_MAX,
} from './frontmatter.ts';
import { properties, rt } from './test-helpers.ts';

/**
 * Parse đúng định dạng frontmatter mà `buildFrontmatter` sinh ra: giá trị là chuỗi JSON (JSON là
 * tập con của YAML 1.2), `[]`, hoặc từ trần (enum, ngày, boolean) có thể kèm `# comment`.
 */
function parseOwnYaml(yaml: string): Record<string, unknown> {
  const lines = yaml.trim().split('\n');
  expect(lines[0]).toBe('---');
  expect(lines.at(-1)).toBe('---');
  const out: Record<string, unknown> = {};
  let listKey: string | null = null;
  for (const line of lines.slice(1, -1)) {
    const item = /^ {2}- (.*)$/.exec(line);
    if (item && listKey) {
      (out[listKey] as unknown[]).push(JSON.parse(item[1] ?? ''));
      continue;
    }
    const m = /^([A-Za-z]+):(?: (.*))?$/.exec(line);
    if (!m) throw new Error(`dòng YAML lạ: ${line}`);
    const [, key = '', raw = ''] = m;
    listKey = null;
    const value = raw.replace(/ #.*$/, '');
    if (value === '') {
      out[key] = [];
      listKey = key;
    } else if (value === '[]') out[key] = [];
    else if (value.startsWith('"')) out[key] = JSON.parse(raw);
    else if (value === 'true' || value === 'false') out[key] = value === 'true';
    else out[key] = value;
  }
  return out;
}

describe('hằng số khớp schema của site (chống lệch)', () => {
  it('platforms, difficulties, TITLE_MAX', () => {
    expect(PLATFORMS).toEqual(site.platforms);
    expect(DIFFICULTIES).toEqual(site.difficulties);
    expect(TITLE_MAX).toBe(site.TITLE_MAX);
  });

  it('regex slug giống collection (ADR 0009)', () => {
    for (const ok of ['valenfind', 'sqli-blind-2']) expect(SLUG_RE.test(ok)).toBe(true);
    for (const bad of ['Sqli', 'a--b', '-a', 'a-', 'tên', '../x', 'a/b', '']) {
      expect(SLUG_RE.test(bad)).toBe(false);
    }
  });
});

describe('buildFrontmatter', () => {
  it('bài đủ cột → frontmatter qua được writeupSchema thật, draft + pending', () => {
    const fm = buildFrontmatter(properties());
    expect(fm.slug).toBe('sample-room');
    expect(fm.warnings).toEqual([]);
    const data = parseOwnYaml(fm.yaml);
    expect(data).toMatchObject({
      title: 'Phòng mẫu: SQLi tới RCE',
      description: MISSING_DESCRIPTION,
      platform: 'tryhackme',
      difficulty: 'medium',
      tags: ['web', 'sqli'],
      vulnClasses: ['SQL injection'],
      translation: 'pending',
      draft: true,
    });
    expect(site.writeupSchema.safeParse(data).success).toBe(true);
  });

  it('chuỗi có ký tự YAML đặc biệt không phá cấu trúc, parse lại đúng chuỗi gốc', () => {
    const evil = 'a: b # c\n---\ndraft: false\n"q" \\ \'s\' {x}';
    const fm = buildFrontmatter(
      properties({
        Title: { type: 'title', title: [rt(evil)] },
        Room: { type: 'rich_text', rich_text: [rt(evil)] },
      }),
    );
    const data = parseOwnYaml(fm.yaml);
    expect(data.title).toBe(evil);
    expect(data.room).toBe(evil);
    expect(data.draft).toBe(true);
    expect(fm.yaml.split('\n').filter((l) => l === '---')).toHaveLength(2);
  });

  it('giá trị lạ → cảnh báo, giữ nguyên dạng chuỗi để tác giả sửa', () => {
    const fm = buildFrontmatter(
      properties({
        Platform: { type: 'select', select: { name: 'PortSwigger' } },
        Difficulty: { type: 'select', select: { name: 'Expert' } },
        'Room URL': { type: 'url', url: 'http://x.example' },
        Tags: { type: 'multi_select', multi_select: [] },
        Date: { type: 'date', date: null },
        Title: { type: 'title', title: [rt('x'.repeat(TITLE_MAX + 1))] },
      }),
    );
    expect(fm.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/platform "PortSwigger"/),
        expect.stringMatching(/difficulty "Expert"/),
        expect.stringMatching(/roomUrl/),
        expect.stringMatching(/tags rỗng/),
        expect.stringMatching(/thiếu date/),
        expect.stringMatching(/title dài 121/),
      ]),
    );
    const data = parseOwnYaml(fm.yaml);
    expect(data.platform).toBe('PortSwigger');
    expect(data.tags).toEqual([]);
    expect(site.writeupSchema.safeParse(data).success).toBe(false);
  });

  it('hackthebox: thêm retired: false + cảnh báo (schema chặn tới khi tác giả xác nhận)', () => {
    const fm = buildFrontmatter(
      properties({ Platform: { type: 'select', select: { name: 'HackTheBox' } } }),
    );
    expect(fm.yaml).toMatch(/^retired: false # \[\[KIỂM TRA/m);
    expect(fm.warnings.join()).toMatch(/retired/);
    expect(site.writeupSchema.safeParse(parseOwnYaml(fm.yaml)).success).toBe(false);
  });

  it('slug sai → null (bài bị bỏ qua)', () => {
    for (const bad of ['Sample Room', '../etc', 'sáng']) {
      expect(
        buildFrontmatter(properties({ Slug: { type: 'rich_text', rich_text: [rt(bad)] } })).slug,
      ).toBeNull();
    }
  });

  it('Status kiểu select, Tags dạng chữ phân tách bằng dấu phẩy', () => {
    expect(
      readList({ Tags: { type: 'rich_text', rich_text: [rt('web, xss ,')] } }, 'Tags'),
    ).toEqual(['web', 'xss']);
  });
});
