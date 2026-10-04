/**
 * Chạy sau `astro build` (turbo task `search:index`): tạo chỉ mục Pagefind trong `dist/pagefind`.
 *
 * Chỉ trang có `data-pagefind-body` (write-up thật, xem WriteupArticle.astro) được index. Nếu
 * không trang nào có thuộc tính này, Pagefind sẽ index MỌI trang (fixture, 404…): script đối
 * chiếu số trang và làm build lỗi thay vì lặng lẽ công khai chúng.
 * Trang tìm kiếm tự dựng trên Pagefind JS API: chỉ giữ các file lõi theo allowlist, xóa bundle
 * UI/highlight không dùng để không deploy JS/CSS bên thứ ba thừa (ADR 0010).
 */
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { close, createIndex } from 'pagefind';

const SITE = fileURLToPath(new URL('../dist/', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../dist/pagefind/', import.meta.url));
/** Chỉ write-up mới có thể là nội dung tìm kiếm. */
const GLOB = '{writeups,en/writeups}/*.html';
const BODY_ATTR = /\sdata-pagefind-body(?=[\s=>])/;
/** File lõi Pagefind cần lúc chạy; mọi thứ khác trong dist/pagefind bị xóa. */
const KEEP = [
  /^pagefind\.js$/,
  /^pagefind-worker\.js$/,
  /^pagefind-entry\.json$/,
  /^pagefind\.[\w-]+\.pf_meta$/,
  /^wasm\.[\w-]+\.pagefind$/,
  /^(?:fragment|index|filter)$/,
];

function fail(step: string, errors: string[]): never {
  console.error(`Pagefind: lỗi khi ${step}:\n${errors.join('\n')}`);
  process.exit(1);
}

/** Số trang HTML trong dist mang `data-pagefind-body`. */
function bodyPageCount(): number {
  return readdirSync(SITE, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .filter((e) => BODY_ATTR.test(readFileSync(`${e.parentPath}/${e.name}`, 'utf8'))).length;
}

const expected = bodyPageCount();
if (expected === 0) {
  fail('kiểm tra đầu vào', [
    'Không trang nào có data-pagefind-body: Pagefind sẽ index toàn bộ site. Dừng lại.',
  ]);
}

const { index, errors } = await createIndex();
if (!index) fail('tạo chỉ mục', errors);

const added = await index.addDirectory({ path: SITE, glob: GLOB });
if (added.errors.length > 0) fail('đọc dist', added.errors);

const written = await index.writeFiles({ outputPath: OUTPUT });
if (written.errors.length > 0) fail('ghi chỉ mục', written.errors);
await close();

const entry = JSON.parse(readFileSync(`${OUTPUT}pagefind-entry.json`, 'utf8')) as {
  languages: Record<string, { page_count: number }>;
};
const indexed = Object.values(entry.languages).reduce((sum, l) => sum + l.page_count, 0);
if (indexed !== expected) {
  fail('đối chiếu', [`Đã index ${indexed} trang, nhưng có ${expected} trang data-pagefind-body.`]);
}

for (const name of readdirSync(OUTPUT)) {
  if (!KEEP.some((re) => re.test(name))) rmSync(`${OUTPUT}${name}`, { recursive: true });
}

console.log(`Pagefind: đã index ${indexed} trang (data-pagefind-body), chỉ mục ở ${OUTPUT}`);
