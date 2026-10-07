import { type Locale, locales, type UiKey } from '@mintshell/shared';
import { type CollectionEntry, getCollection } from 'astro:content';

import type { Difficulty, Platform } from '../schemas/writeup';
import type { FeedSource } from './feed';
import { isListed } from './listing';

export type WriteupEntry = CollectionEntry<'writeups'>;

type Translate = (key: UiKey) => string;

/** Tên hiển thị nền tảng: danh từ riêng giữ nguyên, chỉ `other` dịch theo ngôn ngữ. */
export function platformLabel(platform: Platform, t: Translate): string {
  if (platform === 'tryhackme') return 'TryHackMe';
  if (platform === 'hackthebox') return 'Hack The Box';
  return t('writeups.platform.other');
}

/** Tên hiển thị độ khó theo ngôn ngữ. */
export function difficultyLabel(difficulty: Difficulty, t: Translate): string {
  return t(`writeups.difficulty.${difficulty}`);
}

/** Ngày dạng ISO ngắn `YYYY-MM-DD` (không phụ thuộc ngôn ngữ, hợp phong cách mono). */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Số từ đọc được mỗi phút (ước lượng trung bình khi tự tính readingTime). */
const WORDS_PER_MINUTE = 200;

/** Slug hợp lệ: ASCII thường, chữ số, gạch nối ngăn cách (không gạch nối đầu/cuối/kép). */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `<slug>/<locale>` → slug. */
export function slugOf(id: string): string {
  return id.slice(0, id.lastIndexOf('/'));
}

/**
 * Nạp toàn bộ collection và ép quy ước slug (URL vĩnh viễn — ADR 0004/0009): tên thư mục
 * sai [a-z0-9-] làm build lỗi ngay, không để lọt ra URL công khai.
 */
async function loadAll(): Promise<WriteupEntry[]> {
  const all = await getCollection('writeups');
  for (const entry of all) {
    const slug = slugOf(entry.id);
    if (!SLUG_RE.test(slug)) {
      throw new Error(
        `Slug write-up không hợp lệ (chỉ a-z, 0-9, gạch nối): "${slug}" (id: ${entry.id})`,
      );
    }
  }
  return all;
}

/** `<slug>/<locale>` → locale. */
export function localeOf(id: string): Locale {
  const tail = id.slice(id.lastIndexOf('/') + 1);
  return (locales as readonly string[]).includes(tail) ? (tail as Locale) : 'vi';
}

/** Thời gian đọc (phút): dùng frontmatter nếu có, nếu không ước lượng từ nội dung. */
export function readingTime(entry: WriteupEntry): number {
  if (entry.data.readingTime) return entry.data.readingTime;
  const words = entry.body?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const byDateDesc = (a: WriteupEntry, b: WriteupEntry): number =>
  b.data.date.getTime() - a.data.date.getTime();

/**
 * Bài hiện ở danh sách công khai của một ngôn ngữ (`isListed`): đúng locale, không fixture, không draft
 * (ở production; dev vẫn cho draft để xem thử), và bản ngôn ngữ đó đã dịch (`translation: done`).
 * Mới nhất trước.
 */
export async function listWriteups(locale: Locale): Promise<WriteupEntry[]> {
  const all = await loadAll();
  return all
    .filter((e) => localeOf(e.id) === locale && isListed(e.data, locale, import.meta.env.DEV))
    .sort(byDateDesc);
}

/**
 * Các bản ngôn ngữ của một slug có ở danh sách công khai (`isListed`): hreflang của trang và sitemap chỉ
 * trỏ tới các bản này, không trỏ tới bản draft/pending (không build hoặc noindex) (ADR 0015).
 */
export async function listedLocales(slug: string): Promise<Locale[]> {
  const all = await loadAll();
  return locales.filter((locale) =>
    all.some((e) => e.id === `${slug}/${locale}` && isListed(e.data, locale, import.meta.env.DEV)),
  );
}

/** Bài đưa vào feed RSS của một ngôn ngữ: đúng tập của danh sách công khai (ADR 0010). */
export async function feedWriteups(locale: Locale): Promise<FeedSource[]> {
  const list = await listWriteups(locale);
  return list.map((e) => ({
    slug: slugOf(e.id),
    title: e.data.title,
    description: e.data.description,
    date: e.data.date,
    tags: e.data.tags,
  }));
}

/**
 * Bài build ra trang chi tiết: như danh sách nhưng GIỮ fixture (để test:dist soi).
 * Draft vẫn chỉ build ở dev.
 */
export async function allBuildable(locale: Locale): Promise<WriteupEntry[]> {
  const all = await loadAll();
  return all
    .filter((e) => localeOf(e.id) === locale)
    .filter((e) => import.meta.env.DEV || !e.data.draft)
    .sort(byDateDesc);
}

/** Bài liền trước (mới hơn) và liền sau (cũ hơn) trong danh sách công khai. */
export async function prevNext(
  locale: Locale,
  slug: string,
): Promise<{ prev: WriteupEntry | undefined; next: WriteupEntry | undefined }> {
  const list = await listWriteups(locale);
  const i = list.findIndex((e) => slugOf(e.id) === slug);
  if (i === -1) return { prev: undefined, next: undefined };
  return { prev: list[i - 1], next: list[i + 1] };
}

/** Ảnh mặc định của site, dùng cho trang không có cover riêng (ADR 0012). */
export const DEFAULT_OG_IMAGE = '/og/default.png';

/** Đường dẫn ảnh cover của một write-up; vi và en có ảnh riêng vì tiêu đề khác nhau. */
export function ogImagePath(locale: Locale, slug: string): string {
  return locale === 'vi' ? `/og/writeups/${slug}.png` : `/og/en/writeups/${slug}.png`;
}

/** Trang write-up có cover riêng: mọi bài được build, trừ bản en chưa dịch (dùng ảnh mặc định). */
export const hasCover = (locale: Locale, entry: WriteupEntry): boolean =>
  !(locale === 'en' && entry.data.translation === 'pending');
