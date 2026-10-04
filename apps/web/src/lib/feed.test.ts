import { getRssString } from '@astrojs/rss';
import { useTranslations } from '@mintshell/shared';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import { feedOptions, type FeedSource, toFeedItems } from './feed';

const SITE = new URL('https://mintshell.dev');

/** Dữ liệu độc: ký tự đặc biệt XML, chuỗi giống thẻ/CDATA đóng, để thử escape. */
const HOSTILE: FeedSource = {
  slug: 'xml-escape',
  title: 'Tom & Jerry <script>alert("x")</script> ]]> \'q\'',
  description: 'a < b && c > d "quoted" </description><item>',
  date: new Date('2026-05-01T00:00:00Z'),
  tags: ['a&b', '<tag>'],
};

const OLDER: FeedSource = {
  slug: 'older',
  title: 'Older',
  description: 'Older post',
  date: new Date('2026-01-01T00:00:00Z'),
  tags: [],
};

async function build(locale: 'vi' | 'en', sources: FeedSource[]): Promise<string> {
  return getRssString(feedOptions(sources, locale, SITE, useTranslations(locale)));
}

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

describe('feed RSS', () => {
  it('escape XML đúng: vẫn hợp lệ, ký tự đặc biệt ở dạng entity', async () => {
    const xml = await build('vi', [HOSTILE]);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('Tom &amp; Jerry &lt;script&gt;');
    expect(xml).toContain('a &lt; b &amp;&amp; c &gt; d');
    expect(xml).not.toContain('<script>');
    expect(xml).not.toContain('</description><item>');
    // Đúng một <item>: chuỗi giả thẻ không mở thêm phần tử.
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it('parse lại ra đúng chuỗi gốc', async () => {
    const xml = await build('vi', [HOSTILE]);
    const item = parser.parse(xml).rss.channel.item;
    expect(item.title).toBe(HOSTILE.title);
    expect(item.description).toBe(HOSTILE.description);
    expect(item.category).toEqual([...HOSTILE.tags]);
  });

  it('loại ký tự điều khiển không hợp lệ trong XML 1.0, giữ tab/xuống dòng', async () => {
    const control: FeedSource = {
      ...OLDER,
      title: 'a\u0000b\u0008c\u000Bd\u000Ce\u001Ff',
      description: 'x\ty\nz\u0001',
      tags: ['t\u0007ag'],
    };
    const xml = await build('vi', [control]);
    // XMLValidator KHÔNG bắt ký tự điều khiển (đã thử): kiểm tra thẳng trên XML thô.
    // eslint-disable-next-line no-control-regex -- cố ý tìm ký tự điều khiển.
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(XMLValidator.validate(xml)).toBe(true);
    const item = parser.parse(xml).rss.channel.item;
    expect(item.title).toBe('abcdef');
    expect(item.description).toBe('x\ty\nz');
    expect(item.category).toBe('tag');
  });

  it('link tuyệt đối theo ngôn ngữ, không / cuối', async () => {
    const vi = parser.parse(await build('vi', [HOSTILE])).rss.channel;
    const en = parser.parse(await build('en', [HOSTILE])).rss.channel;
    expect(vi.link).toBe('https://mintshell.dev');
    expect(vi.item.link).toBe('https://mintshell.dev/writeups/xml-escape');
    expect(vi.language).toBe('vi');
    expect(en.link).toBe('https://mintshell.dev/en');
    expect(en.item.link).toBe('https://mintshell.dev/en/writeups/xml-escape');
    expect(en.language).toBe('en');
  });

  it('mới nhất trước', () => {
    const items = toFeedItems([OLDER, HOSTILE], 'vi', SITE);
    expect(items.map((i) => i.link)).toEqual([
      'https://mintshell.dev/writeups/xml-escape',
      'https://mintshell.dev/writeups/older',
    ]);
  });
});
