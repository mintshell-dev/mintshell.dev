import { describe, expect, it } from 'vitest';

import {
  applyImages,
  codeLanguage,
  escapeText,
  MISSING_ALT,
  neutralizeEsm,
  renderPage,
} from './blocks.ts';
import { block, p, rt } from './test-helpers.ts';

const md = (...blocks: Parameters<typeof renderPage>[0]) => renderPage(blocks).markdown.trimEnd();

describe('chữ thường', () => {
  it('escape ký tự đặc biệt Markdown/MDX, gồm { } <', () => {
    expect(escapeText('THM{x} <script> a*b_c [l] `t` ~s~ \\')).toBe(
      'THM\\{x\\} \\<script> a\\*b\\_c \\[l\\] \\`t\\` \\~s\\~ \\\\',
    );
    expect(md(p(rt('flag THM{abc} và <img onerror=x>')))).toBe(
      'flag THM\\{abc\\} và \\<img onerror=x>',
    );
  });

  it('định dạng: đậm, nghiêng, gạch, code; dấu nằm trong khoảng trắng', () => {
    expect(
      md(
        p(
          rt('đậm ', { bold: true }),
          rt('nghiêng', { italic: true }),
          rt(' '),
          rt('gạch', { strikethrough: true }),
          rt(' '),
          rt('a{b}`c', { code: true }),
        ),
      ),
    ).toBe('**đậm** *nghiêng* ~~gạch~~ ``a{b}`c``');
  });

  it('xuống dòng trong đoạn thành ngắt dòng cứng', () => {
    expect(md(p(rt('dòng 1\ndòng 2')))).toBe('dòng 1\\\ndòng 2');
  });
});

describe('link', () => {
  it('giữ https, mã hóa ngoặc/khoảng trắng', () => {
    const r = renderPage([p(rt('xem', {}, 'https://ex.com/a (b)'))]);
    expect(r.markdown.trim()).toBe('[xem](https://ex.com/a%20%28b%29)');
    expect(r.warnings).toEqual([]);
  });

  it('bỏ scheme lạ (javascript:), chỉ giữ chữ, có cảnh báo', () => {
    const r = renderPage([p(rt('bấm', {}, 'javascript:alert(1)'))]);
    expect(r.markdown.trim()).toBe('bấm');
    expect(r.warnings[0]).toMatch(/scheme lạ/);
  });

  it('cảnh báo link nội bộ Notion', () => {
    const r = renderPage([p(rt('trang', {}, '/0123456789abcdef'))]);
    expect(r.warnings[0]).toMatch(/nội bộ Notion/);
  });
});

describe('block', () => {
  it('heading lùi một cấp (h1 → ##)', () => {
    expect(
      md(
        block('heading_1', { rich_text: [rt('Một')] }),
        block('heading_2', { rich_text: [rt('Hai')] }),
        block('heading_3', { rich_text: [rt('Ba')] }),
      ),
    ).toBe('## Một\n\n### Hai\n\n#### Ba');
  });

  it('heading toggle render cả nội dung con', () => {
    expect(
      md(block('heading_2', { rich_text: [rt('H')], is_toggleable: true }, [p(rt('con'))])),
    ).toBe('### H\n\ncon');
  });

  it('code giữ nguyên nội dung, đổi tên ngôn ngữ, fence dài hơn khi có ```', () => {
    expect(md(block('code', { rich_text: [rt('echo {a} <b>')], language: 'shell' }))).toBe(
      '```bash\necho {a} <b>\n```',
    );
    expect(md(block('code', { rich_text: [rt('```x```')], language: 'plain text' }))).toBe(
      '````text\n```x```\n````',
    );
    expect(codeLanguage('C++')).toBe('cpp');
    expect(codeLanguage('c#')).toBe('csharp');
    expect(codeLanguage('Python')).toBe('python');
    expect(codeLanguage(undefined)).toBe('text');
  });

  it('danh sách lồng nhau, đánh số, to-do', () => {
    expect(
      md(
        block('bulleted_list_item', { rich_text: [rt('a')] }, [
          block('bulleted_list_item', { rich_text: [rt('a1')] }),
        ]),
        block('bulleted_list_item', { rich_text: [rt('b')] }),
        p(rt('giữa')),
        block('numbered_list_item', { rich_text: [rt('một')] }),
        block('numbered_list_item', { rich_text: [rt('hai')] }),
        block('to_do', { rich_text: [rt('xong')], checked: true }),
        block('to_do', { rich_text: [rt('chưa')], checked: false }),
      ),
    ).toBe('- a\n\n  - a1\n- b\n\ngiữa\n\n1. một\n2. hai\n\n- [x] xong\n- [ ] chưa');
  });

  it('quote và callout (kèm emoji, nội dung con)', () => {
    expect(md(block('quote', { rich_text: [rt('trích')] }, [p(rt('con'))]))).toBe(
      '> trích\n>\n> con',
    );
    expect(
      md(block('callout', { rich_text: [rt('chú ý')], icon: { type: 'emoji', emoji: '💡' } })),
    ).toBe('> **[Callout 💡]** chú ý');
  });

  it('ảnh: caption làm alt; thiếu caption thì [[THIẾU ALT]]; thu thập ảnh theo thứ tự', () => {
    const r = renderPage([
      block('image', {
        type: 'file',
        file: { url: 'https://s3.example/a.png' },
        caption: [rt('Trang đăng nhập')],
      }),
      block('image', {
        type: 'external',
        external: { url: 'https://img.example/b.jpg' },
        caption: [],
      }),
    ]);
    expect(r.markdown.trim()).toBe(
      `![Trang đăng nhập](notion-image:01)\n\n![${MISSING_ALT}](notion-image:02)`,
    );
    expect(r.images).toEqual([
      { index: 1, url: 'https://s3.example/a.png', source: 'file', alt: 'Trang đăng nhập' },
      { index: 2, url: 'https://img.example/b.jpg', source: 'external', alt: null },
    ]);
  });

  it('bảng có/không header, escape |', () => {
    const row = (...cells: string[]) => block('table_row', { cells: cells.map((c) => [rt(c)]) });
    expect(
      md(block('table', { has_column_header: true }, [row('Cổng', 'Dịch vụ'), row('80', 'a|b')])),
    ).toBe('| Cổng | Dịch vụ |\n| --- | --- |\n| 80 | a\\|b |');
    expect(md(block('table', { has_column_header: false }, [row('x', 'y')]))).toBe(
      '|  |  |\n| --- | --- |\n| x | y |',
    );
  });

  it('divider', () => {
    expect(md(block('divider'))).toBe('---');
  });

  it('block lạ: ghi chú [chưa hỗ trợ: …], vẫn giữ nội dung con, được đếm', () => {
    const r = renderPage([
      block('toggle', { rich_text: [rt('ẩn')] }, [p(rt('bên trong'))]),
      block('equation'),
    ]);
    expect(r.markdown.trim()).toBe('[chưa hỗ trợ: toggle]\n\nbên trong\n\n[chưa hỗ trợ: equation]');
    expect(r.unsupported).toEqual(['toggle', 'equation']);
  });

  it('lồng quá sâu: ghi chú thay vì bỏ im lặng', () => {
    const deep = {
      ...block('quote', { rich_text: [rt('q')] }),
      has_children: true,
      truncated: true,
    };
    const r = renderPage([deep]);
    expect(r.markdown).toContain('[chưa hỗ trợ: lồng quá sâu]');
    expect(r.unsupported).toEqual(['lồng quá sâu']);
  });
});

describe('applyImages', () => {
  it('ảnh external không tải: ghi chú kèm URL đã escape cho MDX', () => {
    expect(
      applyImages(
        '![a](notion-image:03)',
        new Map([[3, { external: 'https://x.example/{a}_b.png' }]]),
      ),
    ).toBe('[[ẢNH EXTERNAL KHÔNG TẢI: https://x.example/\\{a\\}\\_b.png]]');
  });

  it('thay chỗ để bằng đường dẫn đã tải hoặc ghi chú lỗi (không chép URL)', () => {
    const src = `![Trang \\[admin\\]](notion-image:01)\n\n![${MISSING_ALT}](notion-image:02)`;
    const out = applyImages(
      src,
      new Map([
        [1, { path: './images/01-login.png' }],
        [2, { failure: 'HTTP 403' }],
      ]),
    );
    expect(out).toBe(
      '![Trang \\[admin\\]](./images/01-login.png)\n\n[[ẢNH CHƯA TẢI: 02 — HTTP 403]]',
    );
  });
});

describe('ESM của MDX (review M4 H1)', () => {
  it('dòng bắt đầu bằng import/export bị vô hiệu bằng character reference, có cảnh báo', () => {
    const r = renderPage([
      p(rt('export const x = await import("node:child_process")')),
      p(rt('import fs from "node:fs"')),
      block('quote', { rich_text: [rt('export default 1')] }),
      block('bulleted_list_item', { rich_text: [rt('import x')] }),
      p(rt('exporter không phải từ khóa; export ở giữa câu thì không sao')),
    ]);
    const lines = r.markdown.trim().split('\n\n');
    expect(lines[0]).toBe('&#101;xport const x = await import("node:child\\_process")');
    expect(lines[1]).toBe('&#105;mport fs from "node:fs"');
    expect(lines[2]).toBe('> &#101;xport default 1');
    expect(lines[3]).toBe('- &#105;mport x');
    expect(lines[4]).toBe('exporter không phải từ khóa; export ở giữa câu thì không sao');
    expect(r.warnings.filter((w) => /MDX sẽ chạy như mã JS/.test(w))).toHaveLength(4);
  });

  it('không đụng vào code block', () => {
    const r = renderPage([
      block('code', { rich_text: [rt('export PATH=/x\nimport os')], language: 'bash' }),
    ]);
    expect(r.markdown.trim()).toBe('```bash\nexport PATH=/x\nimport os\n```');
    expect(r.warnings).toEqual([]);
    expect(neutralizeEsm('~~~\nexport A=1\n~~~\nexport B', [])).toBe(
      '~~~\nexport A=1\n~~~\n&#101;xport B',
    );
  });
});

describe('dữ liệu ngoài khác (review M4 L1, L3, M1)', () => {
  it('bỏ href tới URL S3 có chữ ký (file đính kèm Notion), giữ chữ, cảnh báo', () => {
    const signed =
      'https://prod-files-secure.s3.us-west-2.amazonaws.com/a/b.pdf?X-Amz-Signature=SIGNED';
    const r = renderPage([p(rt('tài liệu', {}, signed))]);
    expect(r.markdown.trim()).toBe('tài liệu');
    expect(r.markdown).not.toContain('SIGNED');
    expect(r.warnings[0]).toMatch(/URL S3 có chữ ký/);
  });

  it('mention người dùng Notion → cảnh báo (có thể là tên thật)', () => {
    const mention = {
      type: 'mention',
      plain_text: '@Người Dùng',
      mention: { type: 'user' },
      annotations: {},
    };
    const r = renderPage([block('paragraph', { rich_text: [mention] })]);
    expect(r.warnings[0]).toMatch(/mention người dùng Notion.*@Người Dùng/);
  });

  it('emoji callout và lý do ảnh lỗi được escape', () => {
    const r = renderPage([
      block('callout', { rich_text: [rt('x')], icon: { type: 'emoji', emoji: '{a}<b>' } }),
    ]);
    expect(r.markdown.trim()).toBe('> **[Callout \\{a\\}\\<b>]** x');
    expect(applyImages('![a](notion-image:01)', new Map([[1, { failure: 'host x{y}.z' }]]))).toBe(
      '[[ẢNH CHƯA TẢI: 01 — host x\\{y\\}.z]]',
    );
  });
});
