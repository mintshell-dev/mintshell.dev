/**
 * Quét bài nháp để cảnh báo (hàm thuần, chỉ báo, không sửa). Cố ý báo thừa: thà để tác giả tự loại
 * còn hơn bỏ sót một chi tiết lộ danh tính hay lộ đáp án.
 * - flag: THM{…}, HTB{…}, flag{…} chưa che (cả dạng đã escape `\{`); giá trị đã che hợp lệ giống
 *   `apps/web/test-dist/writeups.check.ts`: `<redacted>`, `redacted` (không phân biệt hoa thường);
 *   cả chuỗi 32 hex (dạng flag user.txt/root.txt của HackTheBox, cũng có thể là hash)
 * - ip: mọi IPv4 hợp lệ, gắn nhãn loại địa chỉ
 * - prompt: MỌI chuỗi user@host / user㉿host ở bất kỳ đâu (dấu nhắc terminal, email)
 * - path: đường dẫn home lộ tên người dùng (`/home/<tên>`, `/Users/<tên>`, `C:\Users\<tên>`)
 * Chữ ngoài code được bỏ escape Markdown trước khi quét (`user\_1@host` vẫn khớp).
 */

export type FindingKind = 'flag' | 'ip' | 'prompt' | 'path';

export interface Finding {
  kind: FindingKind;
  /** Số dòng, tính từ 1. */
  line: number;
  match: string;
  note?: string;
}

const REDACTED = /^<?redacted>?$/i;
const FLAG = /\b(THM|HTB|flag)\\?\{([^}\n]*?)\\?\}/gi;
const HEX32 = /(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/gi;
const IPV4 = /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\d|\.\d)/g;
const PROMPT = /[A-Za-z0-9._-]+[@㉿][A-Za-z0-9._-]+/g;
const HOME = /(?:\/home\/|\/Users\/|[A-Za-z]:\\+Users\\+)[^\s/\\`'")\]]+/g;
const FENCE = /^[\s>]*(?:[-*+]\s+|\d+\.\s+)*(`{3,}|~{3,})/;

export function ipLabel(octets: readonly number[]): string {
  const [a = 0, b = 0, c = 0] = octets;
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'riêng tư';
  if (a === 127) return 'loopback';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 100 && b >= 64 && b <= 127) return 'CGNAT';
  if (
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) {
    return 'tài liệu';
  }
  if (a === 0) return 'không định tuyến';
  return 'công khai';
}

/** Bỏ escape Markdown (`\_` → `_`) để quét đúng chữ mà người đọc sẽ thấy. */
const unescape = (s: string) => s.replace(/\\([\\`*_[\]{}<~|])/g, '$1');

export function scanMarkdown(markdown: string): Finding[] {
  const findings: Finding[] = [];
  let fence: string | null = null;

  markdown.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const fenceMarker = FENCE.exec(raw)?.[1];
    if (fenceMarker) {
      if (fence === null) fence = fenceMarker;
      else if (fenceMarker[0] === fence[0] && fenceMarker.length >= fence.length) fence = null;
    }
    const inCode = fence !== null && !fenceMarker;
    // Flag đã escape (`THM\{…\}`) được regex FLAG xử lý trên dòng gốc; phần còn lại quét chữ đã bỏ escape.
    const text = inCode ? raw : unescape(raw);

    for (const m of raw.matchAll(FLAG)) {
      const inner = (m[2] ?? '').replace(/\\(.)/g, '$1').trim();
      if (!REDACTED.test(inner)) findings.push({ kind: 'flag', line, match: m[0] });
    }
    for (const m of text.matchAll(HEX32)) {
      findings.push({ kind: 'flag', line, match: m[0], note: '32 hex: flag HTB hay hash?' });
    }
    for (const m of text.matchAll(IPV4)) {
      const octets = m.slice(1, 5).map(Number);
      if (octets.every((o) => o <= 255)) {
        findings.push({ kind: 'ip', line, match: m[0], note: ipLabel(octets) });
      }
    }
    for (const m of text.matchAll(PROMPT)) {
      findings.push({
        kind: 'prompt',
        line,
        match: m[0],
        ...(inCode ? {} : { note: 'ngoài code' }),
      });
    }
    for (const m of text.matchAll(HOME)) {
      findings.push({ kind: 'path', line, match: m[0] });
    }
  });
  return findings;
}
