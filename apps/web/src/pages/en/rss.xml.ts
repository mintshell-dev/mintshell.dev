import rss from '@astrojs/rss';
import { useTranslations } from '@mintshell/shared';
import type { APIRoute } from 'astro';

import { feedOptions } from '../../lib/feed';
import { feedWriteups } from '../../lib/writeups';

/** Feed tiếng Anh: bỏ thêm bản chưa dịch (translation: pending) (ADR 0010). */
export const GET: APIRoute = async ({ site }) =>
  rss(
    feedOptions(
      await feedWriteups('en'),
      'en',
      site ?? new URL('https://mintshell.dev'),
      useTranslations('en'),
    ),
  );
