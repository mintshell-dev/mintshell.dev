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
 * glob bỏ qua file/thư mục bắt đầu bằng `_` (ví dụ `_import/`), nên chỉ slug hợp lệ được nạp.
 */
const writeups = defineCollection({
  loader: glob({ pattern: '**/{vi,en}.mdx', base: '../../content/writeups' }),
  schema: writeupSchema,
});

export const collections = { portfolio, writeups };
