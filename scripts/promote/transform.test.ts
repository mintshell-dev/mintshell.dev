import { describe, expect, it } from 'vitest';

import {
  convertCallouts,
  findMdxRisks,
  hasMissingDescription,
  normalizeImageAlts,
  promoteMarkdown,
  splitFrontmatter,
} from './transform.ts';

describe('convertCallouts', () => {
  it('đổi callout có emoji thành <Callout type="insight"> theo map, thân là Markdown', () => {
    const r = convertCallouts('trước\n\n> **[Callout 💡]** Nội dung mẫu\n\nsau');
    expect(r.markdown).toBe(
      'trước\n\n<Callout type="insight">\n\nNội dung mẫu\n\n</Callout>\n\nsau',
    );
    expect(r.count).toBe(1);
    expect(r.leftover).toBe(0);
  });

  it('map mỗi emoji trong bảng sang đúng type', () => {
    const cases: [string, string][] = [
      ['🧭', 'tldr'],
      ['🚨', 'critical'],
      ['💡', 'insight'],
      ['🛠️', 'fix'],
      ['📝', 'note'],
    ];
    for (const [emoji, type] of cases) {
      const r = convertCallouts(`> **[Callout ${emoji}]** x`);
      expect(r.markdown).toContain(`<Callout type="${type}">`);
      expect(r.unknownEmojis).toEqual([]);
    }
  });

  it('không emoji → note', () => {
    const r = convertCallouts('> **[Callout]** x');
    expect(r.markdown).toContain('<Callout type="note">');
    expect(r.unknownEmojis).toEqual([]);
  });

  it('emoji lạ → note, kèm cảnh báo trong unknownEmojis', () => {
    const r = convertCallouts('> **[Callout ❓]** x');
    expect(r.markdown).toContain('<Callout type="note">');
    expect(r.unknownEmojis).toEqual(['❓']);
  });

  it('🛠️ (có U+FE0F) và 🛠 (không có) đều map ra fix', () => {
    const withSelector = convertCallouts('> **[Callout 🛠️]** a');
    const withoutSelector = convertCallouts('> **[Callout 🛠]** b');
    expect(withSelector.markdown).toContain('<Callout type="fix">');
    expect(withoutSelector.markdown).toContain('<Callout type="fix">');
  });

  it('byType cộng đúng khi có nhiều type khác nhau', () => {
    const md = ['> **[Callout 🧭]** a', '', '> **[Callout 🚨]** b', '', '> **[Callout]** c'].join(
      '\n',
    );
    const r = convertCallouts(md);
    expect(r.byType).toEqual({ tldr: 1, critical: 1, insight: 0, fix: 0, note: 1 });
  });

  it('đổi callout không emoji, nhiều đoạn và danh sách', () => {
    const md = ['> **[Callout]** Dòng một', '>', '> - ý a', '> - ý b'].join('\n');
    expect(convertCallouts(md).markdown).toBe(
      ['<Callout type="note">', '', 'Dòng một', '', '- ý a', '- ý b', '', '</Callout>'].join('\n'),
    );
  });

  it('giữ nguyên fenced code nằm trong callout (bỏ tiền tố >)', () => {
    const md = ['> **[Callout]** Có code', '>', '> ```sh', '> echo "a"', '> ```'].join('\n');
    const out = convertCallouts(md).markdown;
    expect(out).toContain('```sh\necho "a"\n```');
    expect(out).not.toContain('> ');
  });

  it('không đụng callout giả nằm trong fenced code', () => {
    const md = [
      '```md',
      '> **[Callout 💡]** chỉ là ví dụ',
      '```',
      '~~~~',
      '> **[Callout]** x',
      '~~~~',
    ].join('\n');
    const r = convertCallouts(md);
    expect(r.markdown).toBe(md);
    expect(r.count).toBe(0);
    expect(r.leftover).toBe(0);
  });

  it('fence dài hơn chỉ đóng bằng fence >= độ dài mở', () => {
    const md = ['````', '```', '> **[Callout]** vẫn trong code', '````'].join('\n');
    expect(convertCallouts(md).markdown).toBe(md);
  });

  it('giữ blockquote thường và hai callout liền nhau tách riêng', () => {
    const md = ['> trích dẫn thường', '', '> **[Callout]** A', '> **[Callout]** B'].join('\n');
    const r = convertCallouts(md);
    expect(r.count).toBe(2);
    expect(r.markdown.startsWith('> trích dẫn thường\n\n<Callout type="note">')).toBe(true);
    expect(r.markdown).toContain('A\n\n</Callout>\n\n<Callout type="note">\n\nB');
  });

  it('marker giả bên trong fenced code của callout không cắt khối', () => {
    const md = [
      '> **[Callout]** A',
      '>',
      '> ```md',
      '> > **[Callout]** giả',
      '> ```',
      '>',
      '> sau code',
    ].join('\n');
    const r = convertCallouts(md);
    expect(r.count).toBe(1);
    expect(r.markdown).toContain('```md\n> **[Callout]** giả\n```\n\nsau code\n\n</Callout>');
    expect(r.markdown.match(/<\/Callout>/g)).toHaveLength(1);
  });

  it('báo marker còn sót khi callout lồng (không ở đầu dòng)', () => {
    const r = convertCallouts('- mục\n  > **[Callout]** lồng');
    expect(r.count).toBe(0);
    expect(r.leftover).toBe(1);
  });
});

describe('normalizeImageAlts', () => {
  it('alt rỗng → [[THIẾU ALT]], giữ đường dẫn; alt đã có hoặc [[THIẾU ALT]] giữ nguyên', () => {
    const md = [
      '![](./images/a.png)',
      '![  ](./images/b.png)',
      '![[[THIẾU ALT]]](./images/c.png)',
      '![Mô tả](./images/d.png)',
    ].join('\n');
    const r = normalizeImageAlts(md);
    expect(r.markdown.split('\n')).toEqual([
      '![[[THIẾU ALT]]](./images/a.png)',
      '![[[THIẾU ALT]]](./images/b.png)',
      '![[[THIẾU ALT]]](./images/c.png)',
      '![Mô tả](./images/d.png)',
    ]);
    expect(r.missing.map((m) => [m.path, m.line])).toEqual([
      ['./images/a.png', 1],
      ['./images/b.png', 2],
      ['./images/c.png', 3],
    ]);
  });

  it('không đụng ảnh trong fenced code', () => {
    const md = '```md\n![](./images/x.png)\n```';
    expect(normalizeImageAlts(md)).toEqual({ markdown: md, missing: [] });
  });
});

describe('frontmatter', () => {
  const fm =
    "---\ntitle: 'T'\ndescription: '[[THIẾU MÔ TẢ]]'\ndraft: true\ntranslation: pending\n---\n";

  it('tách frontmatter và nhận ra description còn thiếu', () => {
    expect(splitFrontmatter(`${fm}thân`)).toEqual({ frontmatter: fm, body: 'thân' });
    expect(hasMissingDescription(fm)).toBe(true);
    expect(hasMissingDescription(fm.replace('[[THIẾU MÔ TẢ]]', 'Đã có'))).toBe(false);
    expect(hasMissingDescription('description: [[THIẾU MÔ TẢ]]\n')).toBe(false);
  });

  it('promoteMarkdown giữ frontmatter nguyên văn (draft, translation) và tính dòng alt trên cả file', () => {
    const r = promoteMarkdown(`${fm}\n![](./images/a.png)\n\n> **[Callout 💡]** x\n`);
    expect(r.markdown.startsWith(fm)).toBe(true);
    expect(r.markdown).toContain('draft: true');
    expect(r.missingDescription).toBe(true);
    expect(r.callouts).toBe(1);
    expect(r.missingAlts).toEqual([{ path: './images/a.png', line: 8 }]);
  });

  it('chỉ đổi những gì cần đổi: văn bản không có callout/ảnh giữ nguyên từng byte', () => {
    const md = `${fm}\n## Tiêu đề\n\n\`\`\`text\nTHM{[REDACTED]}\n\`\`\`\n\nđoạn\n`;
    expect(promoteMarkdown(md).markdown).toBe(md);
  });
});

describe('findMdxRisks', () => {
  it('báo { }, <thẻ>, import/export ngoài code; bỏ qua code, inline code và đã escape', () => {
    const md = [
      'a {x}',
      '`{y}` và \\{z\\} và \\<b>',
      '```',
      '{code} <div>',
      '```',
      'export const a = 1',
      'ok <b>x</b>',
    ].join('\n');
    expect(findMdxRisks(md).map((r) => r.line)).toEqual([1, 6, 7]);
  });
});
