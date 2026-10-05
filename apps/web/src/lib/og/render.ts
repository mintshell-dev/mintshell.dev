import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { tokens } from '@mintshell/tokens';
import sharp from 'sharp';

import type { Difficulty } from '../../schemas/writeup';
import { brandCursor, brandPrompt, brandShell, brandViewBox } from '../brand-paths';
import { cachedRender, OG_HEIGHT, OG_WIDTH, type OgCache } from './cache';
import { cleanText, escapeMarkup, truncateWords } from './text';
import { woffToSfnt } from './woff';

/**
 * Ảnh cover Open Graph sinh lúc build (ADR 0012): nền SVG (librsvg) + chữ Pango, ghép bằng
 * sharp. Không gọi dịch vụ ngoài. Màu là token theme tối (ảnh không đọc được CSS variable,
 * design-system: "màu trong file ảnh"); font là `@fontsource` tự host, đổi WOFF1 → TTF.
 */

// `astro build` chạy với cwd là apps/web (pnpm --filter / turbo). Không dùng import.meta.url vì
// module này bị bundle sang thư mục khác khi build.
const WEB_ROOT = process.cwd();
const SOURCES = [join(WEB_ROOT, 'src/lib/og'), join(WEB_ROOT, 'src/lib/brand-paths.ts')];
const CACHE_DIR = join(WEB_ROOT, 'node_modules/.cache/og');

const dark = tokens.theme.dark;
const palette = {
  bg: dark.color.bg,
  surface: dark.color.surface,
  border: dark.color.border,
  borderStrong: dark.color.borderStrong,
  text: dark.color.text,
  muted: dark.color.muted,
  accent: dark.color.accent,
  severity: dark.severity,
} as const;

// Màu đi thẳng vào thuộc tính Pango/SVG: token hỏng không được chèn được markup.
for (const color of [
  ...Object.values(palette).filter((v) => typeof v === 'string'),
  ...Object.values(palette.severity),
]) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error(`OG: màu token không hợp lệ "${color}"`);
}

const difficultyColor: Record<Difficulty, string> = {
  easy: palette.severity.low,
  medium: palette.severity.medium,
  hard: palette.severity.high,
  insane: palette.severity.critical,
};

// Tên family đúng như bảng `name` trong file (fc-query). Dấu phẩy cuối bắt buộc: thiếu nó Pango
// hiểu "SemiBold" là weight, không khớp family và lặng lẽ dùng font khác.
const MONO = 'JetBrains Mono';
const SANS = 'Be Vietnam Pro SemiBold';

/** Mỗi font cần cả subset latin lẫn vietnamese (fontsource tách file). */
const FONT_FILES = [
  ['jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff'],
  ['jetbrains-mono', 'jetbrains-mono-vietnamese-400-normal.woff'],
  ['be-vietnam-pro', 'be-vietnam-pro-latin-600-normal.woff'],
  ['be-vietnam-pro', 'be-vietnam-pro-vietnamese-600-normal.woff'],
] as const;

const PAD_X = 80;
const CONTENT_WIDTH = OG_WIDTH - PAD_X * 2;

interface Rendered {
  data: Buffer;
  width: number;
  height: number;
}

async function text(
  markup: string,
  font: string,
  options: { width?: number; spacing?: number } = {},
): Promise<Rendered> {
  const { data, info } = await sharp({
    text: { text: markup, font, rgba: true, dpi: 72, wrap: 'word', ...options },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const span = (color: string, value: string) =>
  `<span foreground="${color}">${escapeMarkup(value)}</span>`;

/** Đổi font sang TTF, đăng ký với fontconfig, kiểm tra Pango dùng font thật. Chạy một lần. */
async function setup(): Promise<{ fingerprint: string }> {
  if (!existsSync(SOURCES[0] ?? '')) {
    throw new Error(`OG: phải build từ thư mục apps/web (cwd hiện tại: ${WEB_ROOT})`);
  }
  const require = createRequire(join(WEB_ROOT, 'package.json'));
  const dir = mkdtempSync(join(tmpdir(), 'mintshell-og-'));
  process.once('exit', () => rmSync(dir, { recursive: true, force: true }));

  const hash = createHash('sha256');
  for (const [pkg, file] of FONT_FILES) {
    const ttf = woffToSfnt(readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`)));
    const out = join(dir, basename(file, '.woff') + '.ttf');
    writeFileSync(out, ttf);
    hash.update(ttf);
    // fontconfig giữ app font cho cả tiến trình: render một ký tự để đăng ký file.
    await sharp({ text: { text: '.', fontfile: out } })
      .png()
      .toBuffer();
  }

  // Guard: font thiếu thì Pango lặng lẽ dùng font hệ thống. So với một family không tồn tại:
  // trùng ảnh nghĩa là font tự host không được dùng → build lỗi, không xuất ảnh sai font.
  const probe = escapeMarkup('mintshell_ đọc file bằng quyền root');
  const fake = await text(probe, 'Mintshell Missing Font, 40');
  for (const family of [MONO, SANS]) {
    const real = await text(probe, `${family}, 40`);
    if (real.data.equals(fake.data)) {
      throw new Error(`OG: Pango không dùng font "${family}" (đang dùng font dự phòng)`);
    }
  }

  // Dấu vân tay renderer: đổi code, màu, font hay sharp thì mọi khóa cache đổi theo.
  for (const source of SOURCES) {
    const files = source.endsWith('.ts')
      ? [source]
      : readdirSync(source)
          .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
          .sort()
          .map((f) => join(source, f));
    for (const f of files) hash.update(readFileSync(f));
  }
  hash.update(JSON.stringify([palette, sharp.versions, OG_WIDTH, OG_HEIGHT]));
  return { fingerprint: hash.digest('hex') };
}

let ready: Promise<{ fingerprint: string }> | undefined;

/** Dữ liệu một ảnh: mọi thứ hiện trên ảnh, cũng là đầu vào khóa cache. */
export interface OgCard {
  /** Dòng lệnh giả, vd. `cat writeups/valenfind/vi.mdx`. */
  command: string;
  title: string;
  /** Dòng phụ: nền tảng (và độ khó nếu là write-up). */
  meta: string;
  difficulty?: { level: Difficulty; label: string } | undefined;
  tags: string[];
}

/** Tiêu đề tối đa 3 dòng: thử cỡ lớn rồi cỡ nhỏ, vẫn dài thì cắt bớt từ và thêm `…`. */
async function fitTitle(title: string): Promise<Rendered> {
  const spacing = 8;
  const fit = async (value: string, size: number) => {
    const font = `${SANS}, ${size}`;
    // sharp cắt ảnh chữ sát phần mực: mốc 3 dòng phải chứa glyph cao nhất (dấu chồng) và chân
    // chữ thấp nhất, nếu không tiêu đề tiếng Việt 3 dòng bị coi là quá dài.
    const limit = (await text('Ấgỹ\nẤgỹ\nẤgỹ', font, { spacing })).height;
    const out = await text(span(palette.text, value), font, { width: CONTENT_WIDTH, spacing });
    return out.height <= limit ? out : undefined;
  };
  const large = await fit(title, 56);
  if (large) return large;
  const words = title.split(' ').length;
  for (let count = words; count > 0; count--) {
    const small = await fit(truncateWords(title, count), 46);
    if (small) return small;
  }
  throw new Error(`OG: không xếp được tiêu đề "${title}"`);
}

async function render(card: OgCard): Promise<Buffer> {
  const handle = await text(
    span(palette.text, 'mintshell') + span(palette.accent, '_'),
    `${MONO}, 30`,
  );
  const command = await text(
    span(palette.accent, '$') + ' ' + span(palette.muted, card.command),
    `${MONO}, 24`,
  );
  const title = await fitTitle(card.title);
  const meta = await text(
    span(palette.muted, card.meta) +
      (card.difficulty
        ? span(palette.muted, ' · ') +
          span(difficultyColor[card.difficulty.level], card.difficulty.label)
        : ''),
    `${MONO}, 24`,
  );

  // Chip loại lỗi: một hàng ở đáy ảnh, không đủ chỗ thì gộp phần còn lại thành "+N".
  const chipPadX = 14;
  const chipPadY = 8;
  const chipGap = 12;
  const chipTexts = await Promise.all(
    card.tags.map((t) => text(span(palette.text, t), `${MONO}, 22`)),
  );
  const chips: { label: Rendered; x: number }[] = [];
  let x = PAD_X;
  for (const [i, label] of chipTexts.entries()) {
    const remaining = chipTexts.length - i - 1;
    const reserve = remaining > 0 ? 90 : 0;
    if (x + label.width + chipPadX * 2 + reserve > PAD_X + CONTENT_WIDTH) {
      const more = await text(span(palette.muted, `+${chipTexts.length - i}`), `${MONO}, 22`);
      chips.push({ label: more, x });
      break;
    }
    chips.push({ label, x });
    x += label.width + chipPadX * 2 + chipGap;
  }
  const chipHeight = Math.max(0, ...chips.map((c) => c.label.height)) + chipPadY * 2;
  const chipTop = OG_HEIGHT - 64 - chipHeight;

  const titleTop = 186;
  const metaTop = titleTop + title.height + 28;

  const shellScale = 0.85;
  const shellX = 852;
  const shellY = 292;
  const chipRects = chips
    .map(
      (c) =>
        `<rect x="${c.x}" y="${chipTop}" width="${c.label.width + chipPadX * 2}" height="${chipHeight}" rx="4" fill="${palette.surface}" stroke="${palette.borderStrong}" stroke-width="1.5"/>`,
    )
    .join('');
  // Chỉ số và màu token: không có chuỗi từ frontmatter trong SVG nền.
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${palette.bg}"/>
<rect x="24" y="24" width="${OG_WIDTH - 48}" height="${OG_HEIGHT - 48}" rx="8" fill="none" stroke="${palette.border}" stroke-width="2"/>
<g opacity="0.12" fill="none" stroke="${palette.accent}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${shellX} ${shellY}) scale(${shellScale}) translate(${-brandViewBox.x} ${-brandViewBox.y})">
<path d="${brandShell}" stroke-width="24"/>
<polyline points="${brandPrompt}" stroke-width="28"/>
<line x1="${brandCursor.x1}" y1="${brandCursor.y1}" x2="${brandCursor.x2}" y2="${brandCursor.y2}" stroke-width="28"/>
</g>
${chipRects}
</svg>`;

  return sharp(Buffer.from(background))
    .composite([
      { input: handle.data, left: PAD_X, top: 64 },
      { input: command.data, left: PAD_X, top: 124 },
      { input: title.data, left: PAD_X, top: titleTop },
      { input: meta.data, left: PAD_X, top: metaTop },
      ...chips.map((c) => ({
        input: c.label.data,
        left: c.x + chipPadX,
        top: chipTop + chipPadY,
      })),
    ])
    .png()
    .toBuffer();
}

/** PNG 1200×630 cho một thẻ, dùng lại từ cache nếu dữ liệu và renderer không đổi. */
export async function ogPng(card: OgCard, label: string): Promise<Buffer> {
  ready ??= setup();
  const { fingerprint } = await ready;
  const clean: OgCard = {
    command: cleanText(card.command),
    title: cleanText(card.title),
    meta: cleanText(card.meta),
    difficulty: card.difficulty && {
      level: card.difficulty.level,
      label: cleanText(card.difficulty.label),
    },
    tags: card.tags.map(cleanText),
  };
  const cache: OgCache = { dir: CACHE_DIR, fingerprint };
  const { png, hit } = await cachedRender(cache, clean, () => render(clean));
  console.info(`[og] ${hit ? 'cache' : 'render'} ${label}`);
  return png;
}
