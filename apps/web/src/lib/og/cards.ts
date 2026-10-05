import { useTranslations, type Locale } from '@mintshell/shared';

import { difficultyLabel, platformLabel, slugOf, type WriteupEntry } from '../writeups';
import type { OgCard } from './render';

/** Thẻ OG của một write-up: chỉ lấy title, platform, difficulty, vulnClasses, slug, locale. */
export function writeupCard(locale: Locale, entry: WriteupEntry): OgCard {
  const t = useTranslations(locale);
  const d = entry.data;
  return {
    command: `cat writeups/${slugOf(entry.id)}/${locale}.mdx`,
    title: d.title,
    meta: platformLabel(d.platform, t),
    difficulty: { level: d.difficulty, label: difficultyLabel(d.difficulty, t) },
    tags: d.vulnClasses,
  };
}

/** Thẻ OG mặc định của site (một ảnh cho cả hai ngôn ngữ: chữ không cần dịch). */
export function siteCard(): OgCard {
  return {
    command: 'cat README.md',
    title: 'mintshell.dev',
    meta: 'web pentest · CTF · bug bounty',
    tags: [],
  };
}

/** Body PNG cho endpoint tĩnh của Astro. */
export function pngResponse(png: Buffer): Response {
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
