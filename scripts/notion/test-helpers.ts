/** Dựng dữ liệu Notion giả cho test. Không có dữ liệu thật; flag/IP/tên máy đều là giá trị mẫu. */
import type { BlockNode, RichText } from './types.ts';

let counter = 0;

/** ID Notion 32 hex, tăng dần. */
export function id(n = ++counter): string {
  return n.toString(16).padStart(32, '0');
}

export function rt(
  text: string,
  annotations: RichText['annotations'] = {},
  href: string | null = null,
): RichText {
  return { type: 'text', plain_text: text, href, annotations };
}

export function block(
  type: string,
  payload: Record<string, unknown> = {},
  children?: BlockNode[],
): BlockNode {
  return {
    id: id(),
    type,
    has_children: !!children?.length,
    [type]: payload,
    ...(children ? { children } : {}),
  };
}

export const p = (...texts: RichText[]) => block('paragraph', { rich_text: texts });

/** Thuộc tính trang theo đúng tên cột của database "Mintshell". */
export function properties(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    Title: { type: 'title', title: [rt('Phòng mẫu: SQLi tới RCE')] },
    Status: { type: 'status', status: { name: 'Ready' } },
    Slug: { type: 'rich_text', rich_text: [rt('sample-room')] },
    Platform: { type: 'select', select: { name: 'TryHackMe' } },
    Room: { type: 'rich_text', rich_text: [rt('Sample Room')] },
    'Room URL': { type: 'url', url: 'https://tryhackme.com/room/sample' },
    Difficulty: { type: 'select', select: { name: 'Medium' } },
    Tags: { type: 'multi_select', multi_select: [{ name: 'web' }, { name: 'sqli' }] },
    'Vuln classes': { type: 'multi_select', multi_select: [{ name: 'SQL injection' }] },
    Date: { type: 'date', date: { start: '2026-10-05' } },
    Description: {
      type: 'rich_text',
      rich_text: [rt('SQL injection chained into RCE on a sample room.')],
    },
    Version: { type: 'select', select: { name: 'VI' } },
    ...over,
  };
}

/** PNG tối thiểu hợp lệ về cấu trúc chunk; `extraChunks` chèn trước IEND (vd. 'tEXt'). */
export function png(extraChunks: string[] = []): Uint8Array {
  const chunk = (type: string, data: number[] = []) => [
    0,
    0,
    0,
    data.length,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0,
  ];
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...extraChunks.flatMap((t) => chunk(t, [0x61, 0x00, 0x62])),
    ...chunk('IDAT', [0]),
    ...chunk('IEND'),
  ]);
}

/** JPEG tối thiểu: SOI, APP1 (Exif hoặc XMP) tùy chọn, SOS. */
export function jpeg(app1?: 'Exif' | 'XMP'): Uint8Array {
  const sig = app1 === 'Exif' ? 'Exif\0\0' : app1 === 'XMP' ? 'http://ns.adobe.com/xap/1.0/\0' : '';
  const body = [...sig].map((c) => c.charCodeAt(0));
  const seg = app1 ? [0xff, 0xe1, 0, body.length + 2, ...body] : [];
  return new Uint8Array([0xff, 0xd8, ...seg, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}

/** Response giả có thể đặt `url` (mô phỏng chuyển hướng). */
export function response(
  body: ConstructorParameters<typeof Response>[0],
  init: ResponseInit & { url?: string } = {},
): Response {
  const res = new Response(body, init);
  if (init.url) Object.defineProperty(res, 'url', { value: init.url });
  return res;
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
