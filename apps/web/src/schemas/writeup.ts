import { z } from 'astro/zod';

import { httpsUrl } from './portfolio';

const text = z.string().trim().min(1);

export const platforms = ['tryhackme', 'hackthebox', 'other'] as const;
export const difficulties = ['easy', 'medium', 'hard', 'insane'] as const;

export type Platform = (typeof platforms)[number];
export type Difficulty = (typeof difficulties)[number];

/**
 * Frontmatter của một write-up (strict: khóa lạ làm build lỗi). Mỗi bài là thư mục
 * `content/writeups/<slug>/{vi,en}.mdx`; schema này áp cho cả hai ngôn ngữ.
 */
export const writeupSchema = z
  .strictObject({
    title: text,
    description: text,
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    platform: z.enum(platforms),
    room: text,
    roomUrl: httpsUrl,
    difficulty: z.enum(difficulties),
    tags: z.array(text).min(1),
    vulnClasses: z.array(text).min(1),
    // Tự tính từ nội dung nếu thiếu (xem src/lib/writeups.ts).
    readingTime: z.number().int().positive().optional(),
    translation: z.enum(['done', 'pending']),
    draft: z.boolean(),
    // HackTheBox bắt buộc retired: true (chỉ viết về phòng đã nghỉ hưu).
    retired: z.boolean().optional(),
    // Bài kiểm thử khung: build ra trang chi tiết nhưng không bao giờ hiện ở danh sách.
    fixture: z.boolean().default(false),
  })
  .refine((data) => data.platform !== 'hackthebox' || data.retired === true, {
    message: 'platform hackthebox bắt buộc retired: true',
    path: ['retired'],
  });

export type Writeup = z.infer<typeof writeupSchema>;
