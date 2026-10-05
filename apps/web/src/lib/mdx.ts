import { z } from 'astro/zod';

/** Hàm thuần và kiểu cho component MDX (Callout, AttackChain) — ADR 0012. */

export const calloutTypes = ['tldr', 'critical', 'insight', 'note', 'fix'] as const;
export type CalloutType = (typeof calloutTypes)[number];

const text = z.string().trim().min(1);

export const attackChainSchema = z.strictObject({
  /** Mô tả toàn chuỗi cho trình đọc màn hình (`aria-label` của SVG). */
  label: text,
  steps: z
    .array(
      z.strictObject({
        label: text,
        description: text,
        critical: z.boolean().optional(),
      }),
    )
    .min(1),
});

export type AttackChainProps = z.infer<typeof attackChainSchema>;

/**
 * Ngắt chuỗi thành các dòng tối đa `maxChars` ký tự theo từ (chữ mono nên đếm ký tự là đủ).
 * Từ dài hơn một dòng (vd. đường dẫn API) bị cắt cứng để không tràn ngang.
 */
export function wrapText(text: string, maxChars: number): string[] {
  if (maxChars < 1) throw new Error('maxChars phải ≥ 1');
  const lines: string[] = [];
  let line = '';
  // NFC: chữ Việt dạng tổ hợp (NFD, vd. dán từ macOS) đếm thành nhiều ký tự và hiển thị lệch dấu.
  for (const word of text.normalize('NFC').trim().split(/\s+/).filter(Boolean)) {
    let rest = [...word];
    if (line && [...line].length + 1 + rest.length <= maxChars) {
      line += ` ${word}`;
      continue;
    }
    if (line) lines.push(line);
    while (rest.length > maxChars) {
      lines.push(rest.slice(0, maxChars).join(''));
      rest = rest.slice(maxChars);
    }
    line = rest.join('');
  }
  if (line) lines.push(line);
  return lines;
}

/** Chỉ số các bước critical: bước có `critical: true`, nếu không có thì bước cuối. */
export function criticalSteps(steps: { critical?: boolean | undefined }[]): Set<number> {
  const marked = steps.flatMap((s, i) => (s.critical ? [i] : []));
  return new Set(marked.length > 0 ? marked : [steps.length - 1]);
}
