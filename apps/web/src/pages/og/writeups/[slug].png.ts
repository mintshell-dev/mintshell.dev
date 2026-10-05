import type { APIRoute, GetStaticPaths } from 'astro';

import { pngResponse, writeupCard } from '../../../lib/og/cards';
import { ogPng } from '../../../lib/og/render';
import { allBuildable, hasCover, slugOf, type WriteupEntry } from '../../../lib/writeups';

// Cover OG của write-up vi (ADR 0012); khớp ogImagePath('vi', slug).
export const getStaticPaths = (async () => {
  const entries = await allBuildable('vi');
  return entries
    .filter((entry) => hasCover('vi', entry))
    .map((entry) => ({ params: { slug: slugOf(entry.id) }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: WriteupEntry }> = async ({ props }) =>
  pngResponse(await ogPng(writeupCard('vi', props.entry), props.entry.id));
