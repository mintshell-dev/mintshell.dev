import rss from '@astrojs/rss';
import { useTranslations } from '@mintshell/shared';
import type { APIRoute } from 'astro';

import { feedOptions } from '../lib/feed';
import { feedWriteups } from '../lib/writeups';

/** Feed tiếng Việt: write-up đã xuất bản, không draft, không fixture (ADR 0010). */
export const GET: APIRoute = async ({ site }) =>
  rss(
    feedOptions(
      await feedWriteups('vi'),
      'vi',
      site ?? new URL('https://mintshell.dev'),
      useTranslations('vi'),
    ),
  );
