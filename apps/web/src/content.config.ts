import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { portfolioSchema } from './schemas/portfolio';

/** Dữ liệu trang portfolio: một file YAML cho mỗi ngôn ngữ, id = locale (vi, en). */
const portfolio = defineCollection({
  loader: glob({ pattern: '*.yaml', base: '../../content/portfolio' }),
  schema: portfolioSchema,
});

export const collections = { portfolio };
