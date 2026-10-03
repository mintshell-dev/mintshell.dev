import { describe, expect, it } from 'vitest';

import { portfolioSchema, TERMINAL_CMD_MAX } from './portfolio';

const valid = {
  meta: { title: 'portfolio', description: 'mô tả' },
  hero: {
    status: 'Đang nhận dự án',
    title: { lines: ['Tôi phá web', 'để web bền hơn.'], accent: 'bền hơn' },
    intro: 'Giới thiệu',
    ctaContact: 'Trao đổi công việc',
    ctaCv: 'Tải CV',
  },
  terminal: {
    title: '~/mintshell',
    lines: [
      { cmd: 'whoami', out: 'a' },
      { cmd: 'cat focus.txt', out: 'b' },
      { cmd: 'uptime', out: 'c' },
    ],
  },
  stats: [{ label: 'Hạng', value: '[Hạng]' }],
  journey: { label: 'hành trình', body: 'Đoạn văn' },
  approach: { label: 'cách tôi làm việc', body: 'Đoạn văn' },
  skills: { label: 'kỹ năng', items: [{ name: 'Web', description: 'mô tả' }] },
  projects: {
    label: 'việc đã làm',
    items: [
      { name: 'A', description: 'mô tả' },
      { name: 'B', description: 'mô tả', url: 'https://gitlab.com/mintshell/mintshell.dev' },
    ],
  },
  recognition: { label: 'ghi nhận', items: [{ name: '[Chứng chỉ 1]', year: '[Năm]' }] },
  contact: {
    label: 'liên hệ',
    title: 'Nói chuyện nhé.',
    email: 'hi@mintshell.dev',
    links: [{ label: 'GitHub' }],
  },
};

type Data = typeof valid & Record<string, unknown>;

/** Bản sao sâu của `valid` sau khi áp `change`. */
function variant(change: (data: Data) => void): unknown {
  const data = structuredClone(valid) as Data;
  change(data);
  return data;
}

describe('portfolioSchema', () => {
  it('chấp nhận dữ liệu hợp lệ và điền giá trị mặc định', () => {
    const parsed = portfolioSchema.parse(valid);
    expect(parsed.stats[0]?.highlight).toBe(false);
  });

  it('chấp nhận danh sách ghi nhận rỗng', () => {
    const empty = variant((d) => (d.recognition.items = []));
    expect(portfolioSchema.safeParse(empty).success).toBe(true);
  });

  it('chấp nhận cvUrl https hoặc path nội bộ, và pgp đúng định dạng', () => {
    for (const cvUrl of ['https://mintshell.dev/cv.pdf', '/cv.pdf']) {
      expect(
        portfolioSchema.safeParse(variant((d) => Object.assign(d.hero, { cvUrl }))).success,
      ).toBe(true);
    }
    const pgp = '0123 4567 89AB CDEF 0123 4567 89AB CDEF 0123 4567';
    expect(
      portfolioSchema.safeParse(variant((d) => Object.assign(d.contact, { pgp }))).success,
    ).toBe(true);
  });

  it.each([
    ['javascript:alert(1)'],
    ['http://example.com'],
    ['data:text/html,x'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['https://'],
    ['https:evil.example'],
    ['https:/evil.example'],
    ['https://gitlab.com@evil.example/'],
    ['https://user:pass@evil.example/'],
    ['https://localhost'],
  ])('từ chối url %s', (url) => {
    const project = variant((d) => Object.assign(d.projects.items[0]!, { url }));
    const link = variant((d) => Object.assign(d.contact.links[0]!, { url }));
    const cv = variant((d) => Object.assign(d.hero, { cvUrl: url }));
    expect(portfolioSchema.safeParse(project).success).toBe(false);
    expect(portfolioSchema.safeParse(link).success).toBe(false);
    expect(portfolioSchema.safeParse(cv).success).toBe(false);
  });

  it.each<[string, (d: Data) => void]>([
    ['email sai', (d) => (d.contact.email = 'not-an-email')],
    ['terminal 2 dòng', (d) => d.terminal.lines.pop()],
    ['terminal 4 dòng', (d) => d.terminal.lines.push({ cmd: 'id', out: 'x' })],
    ['lệnh quá dài', (d) => (d.terminal.lines[0]!.cmd = 'x'.repeat(TERMINAL_CMD_MAX + 1))],
    ['accent không nằm trong dòng 2', (d) => (d.hero.title.accent = 'Tôi phá')],
    ['khóa lạ', (d) => (d.hero = Object.assign(d.hero, { extra: 'x' }))],
    ['khóa lạ ở gốc', (d) => (d.unknown = 1)],
    ['chuỗi rỗng', (d) => (d.meta.title = '  ')],
    ['quá 4 số liệu', (d) => (d.stats = Array(5).fill(d.stats[0]))],
    ['pgp sai định dạng', (d) => Object.assign(d.contact, { pgp: 'ABCD' })],
    ['thiếu phần liên hệ', (d) => delete (d as Partial<Data>).contact],
    ['kỹ năng rỗng', (d) => (d.skills.items = [])],
    ['dự án rỗng', (d) => (d.projects.items = [])],
    ['thiếu phần hành trình', (d) => delete (d as Partial<Data>).journey],
    ['hành trình rỗng', (d) => (d.journey.body = ' ')],
    ['hành trình có khóa lạ', (d) => Object.assign(d.journey, { years: 6 })],
  ])('từ chối: %s', (_name, change) => {
    expect(portfolioSchema.safeParse(variant(change)).success).toBe(false);
  });
});
