import { plainText } from './types.ts';

/**
 * Thuộc tính trang Notion → frontmatter nháp (hàm thuần). Đối chiếu schema
 * `apps/web/src/schemas/writeup.ts`; hằng số chép sang đây vì `astro/zod` không resolve được từ
 * gốc repo — `frontmatter.test.ts` so khớp để chống lệch. Sai lệch chỉ thành cảnh báo: bài nháp
 * vẫn được ghi để tác giả sửa, schema thật sẽ chặn khi build.
 */

export const TITLE_MAX = 120;
export const PLATFORMS = ['tryhackme', 'hackthebox', 'other'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'] as const;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const MISSING_DESCRIPTION = '[[THIẾU MÔ TẢ]]';
export const MISSING_DATE = '[[THIẾU NGÀY]]';

/** Tên cột trong database Notion "Mintshell". */
export const COLUMNS = {
  title: 'Title',
  status: 'Status',
  slug: 'Slug',
  platform: 'Platform',
  room: 'Room',
  roomUrl: 'Room URL',
  difficulty: 'Difficulty',
  tags: 'Tags',
  vulnClasses: 'Vuln classes',
  date: 'Date',
  description: 'Description',
} as const;

type Prop = Record<string, unknown> & { type?: unknown };

function prop(props: Record<string, unknown>, name: string): Prop | null {
  const p = props[name];
  return p && typeof p === 'object' ? (p as Prop) : null;
}

/** Đọc cột dạng chuỗi, chấp nhận title/rich_text/select/status/url. */
export function readText(props: Record<string, unknown>, name: string): string {
  const p = prop(props, name);
  if (!p) return '';
  switch (p.type) {
    case 'title':
    case 'rich_text':
      return plainText(p[p.type]).trim();
    case 'select':
    case 'status': {
      const v = p[p.type] as { name?: unknown } | null;
      return typeof v?.name === 'string' ? v.name.trim() : '';
    }
    case 'url':
      return typeof p.url === 'string' ? p.url.trim() : '';
    default:
      return '';
  }
}

export function readList(props: Record<string, unknown>, name: string): string[] {
  const p = prop(props, name);
  if (p?.type === 'multi_select' && Array.isArray(p.multi_select)) {
    return p.multi_select
      .map((o) =>
        o && typeof (o as { name?: unknown }).name === 'string'
          ? (o as { name: string }).name.trim()
          : '',
      )
      .filter(Boolean);
  }
  // Cho phép cột chữ thường, phân tách bằng dấu phẩy.
  return readText(props, name)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readDate(props: Record<string, unknown>, name: string): string {
  const p = prop(props, name);
  const start = p?.type === 'date' ? (p.date as { start?: unknown } | null)?.start : undefined;
  const value = typeof start === 'string' ? start.slice(0, 10) : readText(props, name);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

/** Chuỗi YAML nháy kép. JSON là tập con của YAML 1.2 nên an toàn với `:`, `#`, xuống dòng, `---`… */
export const yamlString = (s: string) => JSON.stringify(s);

function enumValue(
  raw: string,
  allowed: readonly string[],
  key: string,
  warnings: string[],
): string {
  const v = raw.toLowerCase().replace(/\s+/g, '');
  if (allowed.includes(v)) return v;
  warnings.push(`${key} "${raw}" không thuộc ${allowed.join('|')}`);
  return yamlString(raw);
}

function yamlList(key: string, items: string[]): string {
  return items.length
    ? `${key}:\n${items.map((i) => `  - ${yamlString(i)}`).join('\n')}`
    : `${key}: []`;
}

export interface FrontmatterResult {
  /** Slug hợp lệ, hoặc `null` (bài bị bỏ qua). */
  slug: string | null;
  rawSlug: string;
  title: string;
  /** Khối `---` … `---` kèm dòng trống cuối. */
  yaml: string;
  warnings: string[];
}

export function buildFrontmatter(props: Record<string, unknown>): FrontmatterResult {
  const warnings: string[] = [];
  const rawSlug = readText(props, COLUMNS.slug);
  const slug = SLUG_RE.test(rawSlug) ? rawSlug : null;

  const title = readText(props, COLUMNS.title);
  if (!title) warnings.push('thiếu title');
  if ([...title].length > TITLE_MAX) {
    warnings.push(`title dài ${[...title].length} ký tự (tối đa ${TITLE_MAX}, ADR 0012)`);
  }

  const platformRaw = readText(props, COLUMNS.platform);
  const platform = platformRaw
    ? enumValue(platformRaw, PLATFORMS, 'platform', warnings)
    : (warnings.push('thiếu platform'), '""');

  const difficultyRaw = readText(props, COLUMNS.difficulty);
  const difficulty = difficultyRaw
    ? enumValue(difficultyRaw, DIFFICULTIES, 'difficulty', warnings)
    : (warnings.push('thiếu difficulty'), '""');

  const room = readText(props, COLUMNS.room);
  if (!room) warnings.push('thiếu room');

  const roomUrl = readText(props, COLUMNS.roomUrl);
  if (!roomUrl.startsWith('https://')) warnings.push('roomUrl không phải https://');

  const date = readDate(props, COLUMNS.date);
  if (!date) warnings.push('thiếu date (YYYY-MM-DD)');

  const tags = readList(props, COLUMNS.tags);
  if (!tags.length) warnings.push('tags rỗng');
  const vulnClasses = readList(props, COLUMNS.vulnClasses);
  if (!vulnClasses.length) warnings.push('vulnClasses rỗng');

  // Cột Description của Notion là tiếng Anh (bài gốc), đổ vào description của bản được kéo. Bản dịch
  // tiếng Việt cần description tiếng Việt riêng, điền khi dịch (ngoài phạm vi script).
  const description = readText(props, COLUMNS.description);
  if (!description) warnings.push('description rỗng');

  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description || MISSING_DESCRIPTION)}`,
    `date: ${date || yamlString(MISSING_DATE)}`,
    `platform: ${platform}`,
    `room: ${yamlString(room)}`,
    `roomUrl: ${yamlString(roomUrl)}`,
    `difficulty: ${difficulty}`,
    yamlList('tags', tags),
    yamlList('vulnClasses', vulnClasses),
    'translation: pending',
    'draft: true',
  ];
  if (platform === 'hackthebox') {
    lines.push('retired: false # [[KIỂM TRA: phòng đã retired? schema bắt buộc true]]');
    warnings.push('hackthebox: kiểm tra phòng đã retired rồi đặt retired: true');
  }
  lines.push('---', '');

  return { slug, rawSlug, title, yaml: lines.join('\n'), warnings };
}
