import type { APIRoute, GetStaticPaths } from 'astro';

import { pngResponse, writeupCard } from '../../../../lib/og/cards';
import { ogPng } from '../../../../lib/og/render';
import { allBuildable, hasCover, slugOf, type WriteupEntry } from '../../../../lib/writeups';

// Cover OG của write-up en (ADR 0012); khớp ogImagePath('en', slug).
export const getStaticPaths = (async () => {
  const entries = await allBuildable('en');
  return entries
    .filter((entry) => hasCover('en', entry))
    .map((entry) => ({ params: { slug: slugOf(entry.id) }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: WriteupEntry }> = async ({ props }) =>
  pngResponse(await ogPng(writeupCard('en', props.entry), props.entry.id));
