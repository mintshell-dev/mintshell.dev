import { describe, expect, it } from 'vitest';

import { attr, readDist, tags } from './dist-files';

const pages = [
  ['vi', 'portfolio.html'],
  ['en', 'en/portfolio.html'],
] as const;

/** Câu chuyện "4 năm viết web, 2 năm phá web" chỉ được kể ở phần hành trình. */
const storyMarkers = /Bốn năm|Hai năm|Four years|two years|muộn|\blate\b/i;

/** Văn bản của section có id cho trước (bỏ thẻ, giải mã &#39;). */
function sectionText(html: string, id: string): string {
  const match = new RegExp(`<section\\b[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</section>`).exec(html);
  if (!match?.[1]) throw new Error(`Không tìm thấy section #${id}`);
  return match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Phần tử (thẻ mở + nội dung) đầu tiên có class `cls`, giả định không lồng cùng tên thẻ. */
function findBlock(html: string, tag: string, cls: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>[\\s\\S]*?</${tag}>`);
  return re.exec(html)?.[0];
}

function block(html: string, tag: string, cls: string): string {
  const found = findBlock(html, tag, cls);
  if (!found) throw new Error(`Không tìm thấy <${tag} class="${cls}">`);
  return found;
}

const count = (html: string, re: RegExp): number => html.match(re)?.length ?? 0;

/** Số hàng của từng phần, để so khớp giữa vi và en. */
function shape(html: string): Record<string, number> {
  return {
    stats: count(block(html, 'dl', 'stats'), /<div\b/g),
    skills: count(block(html, 'dl', 'skills'), /<div\b/g),
    projects: count(block(html, 'ul', 'projects'), /<li\b/g),
    projectLinks: count(block(html, 'ul', 'projects'), /<a\b/g),
    // Ghi nhận có thể rỗng (phần bị ẩn): đếm 0.
    recognition: count(findBlock(html, 'ul', 'recognition') ?? '', /<li\b/g),
  };
}

describe.each(pages)('portfolio %s', (_locale, path) => {
  const html = readDist(path);

  it('có phần hành trình, nằm sau số liệu và trước "cách tôi làm việc"', () => {
    const stats = html.indexOf('<dl class="stats');
    const journeyAt = html.indexOf('id="hanh-trinh"');
    const approach = html.indexOf('id="cach-lam-viec"');
    expect(stats).toBeGreaterThan(-1);
    expect(journeyAt).toBeGreaterThan(stats);
    expect(approach).toBeGreaterThan(journeyAt);
    // Chỉ kiểm tra cấu trúc (có tiêu đề và đoạn văn), không khóa nội dung chữ.
    expect(sectionText(html, 'hanh-trinh').length).toBeGreaterThan(0);
    const section = /<section\b[^>]*\sid="hanh-trinh"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0];
    expect(section).toMatch(/<h2\b/);
    expect(section).toMatch(/<p\b[^>]*class="[^"]*\bprose\b/);
  });

  it('mọi phần bên dưới hero đều hiện dần khi cuộn', () => {
    const sections = tags(html, 'section').filter((s) => attr(s, 'class')?.includes('section'));
    // "// ghi nhận" chỉ có khi danh sách ghi nhận không rỗng.
    const hasRecognition = findBlock(html, 'ul', 'recognition') !== undefined;
    expect(sections.map((s) => attr(s, 'id'))).toEqual([
      'hanh-trinh',
      'cach-lam-viec',
      'ky-nang',
      'viec-da-lam',
      ...(hasRecognition ? ['ghi-nhan'] : []),
      'lien-he',
    ]);
    for (const section of sections) expect(attr(section, 'class')?.split(' ')).toContain('reveal');
  });

  it('câu chuyện nghề nghiệp không lặp ở hero', () => {
    const lead = /<p\b[^>]*class="[^"]*\blead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1];
    expect(lead).toBeTruthy();
    expect(lead).not.toMatch(storyMarkers);
    for (const id of ['cach-lam-viec', 'ky-nang', 'viec-da-lam']) {
      expect(sectionText(html, id)).not.toMatch(storyMarkers);
    }
  });

  it('có phần liên hệ id="lien-he", email và nút chính trỏ tới đó', () => {
    expect(tags(html, 'section').filter((s) => attr(s, 'id') === 'lien-he')).toHaveLength(1);
    expect(html).toContain('href="mailto:hi@mintshell.dev"');
    expect(html).toContain('>hi@mintshell.dev</a>');
    const primary = tags(html, 'a').find((a) => attr(a, 'class')?.includes('btn-primary'));
    expect(primary && attr(primary, 'href')).toBe('#lien-he');
  });

  it('không có style= và chỉ có hai script đã biết', () => {
    expect(html).not.toMatch(/\sstyle\s*=/i);
    const scripts = tags(html, 'script').map((s) => attr(s, 'src'));
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toBe('/theme-init.js');
    expect(scripts[1]).toMatch(/^\/_astro\/ThemeToggle\.[^/]+\.js$/);
  });

  it('terminal giả được ẩn với trình đọc màn hình', () => {
    const terminal = tags(html, 'div').find((d) =>
      attr(d, 'class')?.split(' ').includes('terminal'),
    );
    expect(terminal && attr(terminal, 'aria-hidden')).toBe('true');
  });

  it('mọi link ra ngoài là https', () => {
    for (const a of tags(html, 'a')) {
      const href = attr(a, 'href') ?? '';
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) expect(href, a).toMatch(/^(https:\/\/|mailto:)/);
    }
  });

  it('hàng dự án tĩnh không phải link và không có class hover', () => {
    const projects = block(html, 'ul', 'projects');
    const rows = [...projects.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');
    for (const row of rows) {
      const isLink = /^\s*<a\b/.test(row);
      expect(row.includes('project-link'), row).toBe(isLink);
      expect(row.includes('class="arrow"'), row).toBe(isLink);
      if (isLink) expect(attr(tags(row, 'a')[0] ?? '', 'href')).toMatch(/^https:\/\//);
    }
    expect(rows.length).toBeGreaterThan(0);
  });

  it('không còn là trang tạm', () => {
    expect(html).not.toMatch(/Đang xây dựng|Under construction/);
  });
});

describe('portfolio vi và en', () => {
  it('có cùng số hàng ở mọi phần', () => {
    expect(shape(readDist('en/portfolio.html'))).toEqual(shape(readDist('portfolio.html')));
  });
});
