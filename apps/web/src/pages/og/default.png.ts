import type { APIRoute } from 'astro';

import { pngResponse, siteCard } from '../../lib/og/cards';
import { ogPng } from '../../lib/og/render';

// Ảnh OG mặc định của site (ADR 0012): /og/default.png.
export const GET: APIRoute = async () => pngResponse(await ogPng(siteCard(), 'default'));
