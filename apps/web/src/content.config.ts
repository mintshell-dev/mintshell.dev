import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { portfolioSchema } from './schemas/portfolio';
import { writeupSchema } from './schemas/writeup';

/** Dữ liệu trang portfolio: một file YAML cho mỗi ngôn ngữ, id = locale (vi, en). */
const portfolio = defineCollection({
  loader: glob({ pattern: '*.yaml', base: '../../content/portfolio' }),
  schema: portfolioSchema,
});

/**
 * Write-up: thư mục `content/writeups/<slug>/{vi,en}.mdx`, id = `<slug>/<locale>`.
 * Loader glob KHÔNG tự bỏ qua thư mục `_` (quy ước `_` của Astro chỉ áp cho routing `src/pages`),
 * nên loại trừ tường minh mọi thư mục bắt đầu bằng `_` (vd. `_import/` của `pnpm notion:pull`, ADR 0013). Lớp chặn slug ASCII
 * (`lib/writeups.ts`) vẫn là phòng tuyến hai: id lạ làm build lỗi chứ không xuất bản.
 */
const writeups = defineCollection({
  loader: glob({
    pattern: ['**/{vi,en}.mdx', '!**/_*/**'],
    base: '../../content/writeups',
  }),
  schema: writeupSchema,
});

export const collections = { portfolio, writeups };
