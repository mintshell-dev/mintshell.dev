import { localizePath, type Locale, type UiKey } from '@mintshell/shared';
import type { RSSFeedItem, RSSOptions } from '@astrojs/rss';

/**
 * Dữ liệu tối thiểu của một write-up để đưa vào feed. Tách khỏi `astro:content` để hàm thuần,
 * unit test được (escape XML) mà không cần Astro.
 */
export interface FeedSource {
  slug: string;
  title: string;
  description: string;
  date: Date;
  tags: readonly string[];
}

type Translate = (key: UiKey) => string;

/** URL tuyệt đối của trang (đúng ngôn ngữ, không `/` cuối — ADR 0007). */
function absolute(path: string, locale: Locale, site: URL): string {
  return new URL(localizePath(path, locale), site).href.replace(/\/$/, '');
}

/**
 * Ký tự điều khiển C0 không hợp lệ trong XML 1.0 (trừ tab, LF, CR). Builder chỉ escape
 * `& < > " '`, không lọc nhóm này → feed hỏng, reader từ chối.
 */
// eslint-disable-next-line no-control-regex -- cố ý khớp ký tự điều khiển để loại bỏ.
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

const xmlSafe = (text: string): string => text.replace(XML_INVALID, '');

/** Item RSS theo ngôn ngữ, mới nhất trước; link luôn tuyệt đối; chữ đã lọc ký tự điều khiển. */
export function toFeedItems(
  sources: readonly FeedSource[],
  locale: Locale,
  site: URL,
): RSSFeedItem[] {
  return [...sources]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((s) => ({
      title: xmlSafe(s.title),
      description: xmlSafe(s.description),
      pubDate: s.date,
      link: absolute(`/writeups/${s.slug}`, locale, site),
      categories: s.tags.map(xmlSafe),
    }));
}

/** Toàn bộ tuỳ chọn feed của một ngôn ngữ: kênh trỏ trang chủ đúng ngôn ngữ. */
export function feedOptions(
  sources: readonly FeedSource[],
  locale: Locale,
  site: URL,
  t: Translate,
): RSSOptions {
  return {
    title: t('feed.title'),
    description: t('feed.description'),
    site: absolute('/', locale, site),
    trailingSlash: false,
    items: toFeedItems(sources, locale, site),
    // Giá trị cố định từ danh sách locale, không phải dữ liệu người dùng (customData là XML thô).
    customData: `<language>${locale}</language>`,
  };
}
