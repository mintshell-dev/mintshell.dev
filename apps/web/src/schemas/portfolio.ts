import { z } from 'astro/zod';

/** Số ký tự tối đa của một lệnh terminal, khớp `--type-chars` trong Terminal.astro. */
export const TERMINAL_CMD_MAX = 24;

const text = z.string().trim().min(1);

/**
 * Chỉ `https://host/…`, để href không thể là `javascript:`, `data:` hay `http:`. Bắt buộc
 * `//` (trình duyệt hiểu `https:host` là path tương đối) và cấm userinfo
 * (`https://gitlab.com@evil.example` trông như GitLab nhưng trỏ sang host khác).
 */
export const httpsUrl = z
  .url({ protocol: /^https$/, hostname: z.regexes.domain })
  .refine((u) => u.startsWith('https://'), { message: 'URL phải bắt đầu bằng https://' })
  .refine(
    // Zod 4 vẫn chạy refine khi bước trước đã lỗi, nên không giả định `u` parse được.
    (u) => {
      if (!URL.canParse(u)) return false;
      const { username, password } = new URL(u);
      return username === '' && password === '';
    },
    { message: 'URL không được chứa thông tin đăng nhập' },
  );

/** https hoặc path nội bộ `/…` (không phải `//host`). */
const httpsOrLocal = z.union([httpsUrl, z.string().regex(/^\/(?![/\\])[^\s]*$/)]);

/** Phần một đoạn văn: nhãn mono bên trái, đoạn văn cỡ lớn bên phải. */
const prose = z.strictObject({ label: text, body: text });

const labelled = <T extends z.ZodType>(item: T) =>
  z.strictObject({ label: text, items: z.array(item).min(1) });

export const portfolioSchema = z.strictObject({
  meta: z.strictObject({ title: text, description: text }),
  hero: z.strictObject({
    status: text,
    title: z
      .strictObject({ lines: z.tuple([text, text]), accent: text })
      .refine((t) => t.lines[1].includes(t.accent), {
        message: 'hero.title.accent phải nằm trong dòng thứ hai',
        path: ['accent'],
      }),
    intro: text,
    ctaContact: text,
    ctaCv: text,
    cvUrl: httpsOrLocal.optional(),
  }),
  terminal: z.strictObject({
    title: text,
    lines: z.array(z.strictObject({ cmd: text.max(TERMINAL_CMD_MAX), out: text })).length(3),
  }),
  stats: z
    .array(z.strictObject({ label: text, value: text, highlight: z.boolean().default(false) }))
    .min(1)
    .max(4),
  /** Câu chuyện nghề nghiệp, chỉ kể ở đây (hero intro giữ ngắn gọn). */
  journey: prose,
  approach: prose,
  skills: labelled(z.strictObject({ name: text, description: text })),
  projects: labelled(z.strictObject({ name: text, description: text, url: httpsUrl.optional() })),
  // Ghi nhận được phép rỗng; khi rỗng thì ẩn cả phần "// ghi nhận".
  // `level` (mức độ, ví dụ Hall of Fame) hiển thị màu highlight.
  recognition: z.strictObject({
    label: text,
    items: z.array(z.strictObject({ name: text, year: text, level: text.optional() })),
  }),
  contact: z.strictObject({
    label: text,
    title: text,
    email: z.email(),
    links: z.array(z.strictObject({ label: text, url: httpsUrl.optional() })),
    /** Fingerprint OpenPGP: 40 ký tự hex, chia nhóm 4. */
    pgp: z
      .string()
      .regex(/^[0-9A-F]{4}( ?[0-9A-F]{4}){9}$/)
      .optional(),
  }),
});

export type Portfolio = z.infer<typeof portfolioSchema>;
