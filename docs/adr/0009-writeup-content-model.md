# ADR 0009 — Mô hình nội dung write-up và tô màu cú pháp an toàn CSP

Ngày: 2026-10-04 · Trạng thái: Đã chấp nhận · Mốc: M3a

## Bối cảnh

M3a dựng khung cho write-up CTF. Cần: mô hình nội dung song ngữ theo slug chung, tô màu cú
pháp cho khối code, nút sao chép. Ràng buộc nền tảng: CSP giai đoạn M5 chỉ cho `'self'`
(không script/style nội tuyến, không `style=`), nội dung lưu trong Git dạng MDX.

## Quyết định

### Mô hình nội dung

- Mỗi write-up là thư mục `content/writeups/<slug>/` gồm `vi.mdx` (bản chính), `en.mdx` (tùy
  chọn) và ảnh. Slug ASCII thường, gạch nối, vĩnh viễn, dùng chung hai ngôn ngữ (ADR 0004).
- Content collection `writeups` (glob `**/{vi,en}.mdx`), id = `<slug>/<locale>`. glob bỏ qua
  thư mục bắt đầu bằng `_` (ví dụ `_import/`) nên nội dung nháp ngoài collection không được nạp.
- Schema Zod strict ở `apps/web/src/schemas/writeup.ts` (không đặt ở `packages/shared` để shared
  khỏi phụ thuộc zod, giống portfolio). `platform: hackthebox` bắt buộc `retired: true`.
  `draft: true` không build ra trang công khai (chỉ hiện ở dev).
- Trường `fixture` (mặc định `false`): bài kiểm thử khung — build ra trang chi tiết để `test:dist`
  soi, nhưng không bao giờ hiện ở trang danh sách (cả dev lẫn production).
- Danh sách công khai (`/writeups`, `/en/writeups`, trang chủ, prev/next, RSS) theo `isListed`
  (`apps/web/src/lib/listing.ts`): mỗi ngôn ngữ chỉ liệt kê bài có bản ngôn ngữ đó thật
  (`translation: done`), không fixture, không draft (trừ dev). Bài `vi` pending không hiện ở danh sách vi, bài
  `en` pending không hiện ở danh sách en; Pagefind cũng không index bản pending.
- Bản `en` có `translation: pending`: trang `noindex`, hiện thông báo + link sang bản vi, không
  render nội dung dịch dở; không khai báo `<link rel=alternate hreflang>` cho cặp đó.

### Tô màu cú pháp: Prism thay vì Shiki

Shiki (mặc định của Astro) sinh `style=` nội tuyến cho từng token → vi phạm CSP `'self'`. Thay
vì thêm transformer để chuyển style thành class (một dependency nữa, classname sinh tự động),
dùng **Prism built-in** của Astro (`markdown.syntaxHighlight: 'prism'`):

- `prismjs` đã có sẵn trong node_modules (Astro bundle) → **không thêm dependency** cho tô màu.
- Prism chỉ gắn class `.token.*`, **không** `style=` → an toàn CSP tuyệt đối.
- Màu cú pháp là **token thiết kế** trong `packages/tokens` (`color.syntax.*`, tách theo theme),
  có test tương phản ≥ 4.5:1 trên `color.surface` ở cả hai theme (pattern M1). CSS ở
  `apps/web/src/styles/prism.css` chỉ ánh xạ `.token.*` → `var(--color-syntax-*)`, không ghi
  cứng màu.

Dependency mới duy nhất của mốc: `@astrojs/mdx` (render `.mdx`).

### Phòng thủ nhiều tầng cho nội dung MDX

Nội dung MDX cho phép HTML/JSX thô. Coi nội dung (nhất là khi đồng bộ từ Notion ở M4) là **dữ
liệu**, nên không dựa vào tác giả tự giữ sạch:

- **Tầng build (phòng tuyến trước, M3a):** `test:dist` (`inline.check`) quét toàn bộ HTML build
  và làm **build FAIL** nếu có: `style=`/`<style>`/script không-`src`/`data:` URI (đã có từ M2),
  **thuộc tính handler `on*=` trong thẻ thật**, hoặc **thẻ nguy hiểm** `iframe`/`object`/`embed`/
  `form`. Các check chỉ bắt thẻ thật — chuỗi như `&lt;img onerror=…&gt;` trong khối code (nội
  dung hợp lệ của write-up về XSS) đã HTML-escape nên không dính.
- **Tầng CSP (phòng tuyến hai, M5):** CSP `'self'` chặn thực thi script/style nội tuyến còn sót.
- **rehype-sanitize:** cân nhắc ở **M4** khi thêm pipeline nội dung từ Notion (xem ghi chú dưới).

Slug được ép ngay khi nạp collection (`src/lib/writeups.ts`, `loadAll`): tên thư mục không khớp
`^[a-z0-9]+(-[a-z0-9]+)*$` làm build lỗi — biến quy ước URL vĩnh viễn (ADR 0004) thành ràng buộc code.

### Ghi chú: rehype/remark plugin cần dependency ở Astro 7

Astro 7.3.5 dùng **Sätteri** làm markdown processor mặc định; `@astrojs/markdown-remark` (bộ xử
lý unified cho remark/rehype) **không còn cài mặc định**. Hệ quả: plugin remark/rehype — kể cả
truyền qua `mdx({ rehypePlugins })` — **không chạy** nếu thiếu `@astrojs/markdown-remark`.

**Quyết định: hoãn sang M4.** Không đổi engine markdown (rủi ro cho Prism đang chạy) chỉ để gắn
`rel`, cũng không enforce bằng test (tạo ma sát mỗi lần viết link markdown). Khi M4 thêm pipeline
nội dung Notion sẽ cân nhắc `@astrojs/markdown-remark` + `rehype-sanitize` một thể, và plugin tự
gắn `rel`/`target` cho link ngoài đi kèm lúc đó.

- **Khoảng trống:** link ngoài trong _thân_ MDX chưa tự gắn `rel="noopener noreferrer"` (link
  `roomUrl` ở metadata thì đã có `rel` đúng, vì không đi qua MDX).
- **Rủi ro hiện tại:** thấp — chỉ reverse tabnabbing; nội dung trong Git là tin cậy (qua MR).
- **Phòng tuyến tạm:** CSP ở M5. Xử lý dứt điểm ở M4 cùng `rehype-sanitize`.
- **Khi viết bài thủ công:** nếu muốn chắc, tự thêm `rel` vào thẻ `<a>` cho link ngoài.

### Nút sao chép và ảnh

- Nút sao chép do script ngoài `public/copy-code.js` gắn (không nội tuyến, hợp CSP; giống
  `theme-init.js`). Progressive enhancement: không JS vẫn đọc và bôi đen code được.
- Ảnh qua `astro:assets` (`alt` bắt buộc), không ảnh từ URL ngoài.

### Ràng buộc kiểm tra bản build

`test:dist` (`writeups.check.ts`) báo lỗi nếu bản build lộ flag `THM{…}`/`HTB{…}` chưa che
(chỉ cho dạng đã che `THM{<redacted>}` / `THM{REDACTED}`, tính cả khi HTML-escaped), xác nhận
Prism sinh `.token.*`, fixture ẩn khỏi danh sách, và nhánh en pending noindex + không hreflang.

## Hệ quả

- Prism có độ bao phủ ngữ pháp hẹp hơn Shiki; đủ cho bash/http/python/js thường gặp trong
  write-up. Nếu sau này cần ngữ pháp hiếm, cân nhắc lại (sẽ ghi ADR mới).
- Trang vi của một bài có bản en pending vẫn khai báo `hreflang=en` trỏ tới trang en noindex
  (hreflang một chiều, công cụ tìm kiếm bỏ qua). Không khắc phục ở M3a để không sửa `BaseLayout`
  dùng chung; cân nhắc khi làm SEO ở M5.
- Link ngoài trong _thân_ MDX chưa tự gắn `rel`/`target` (xem ghi chú về rehype ở trên) — chờ
  quyết định dependency.

## Thay thế đã cân nhắc

- **Shiki + `@shikijs/transformers` (transformerStyleToClass)**: thêm 1 dependency, classname
  băm tự động, rủi ro CSP cao hơn. Bỏ vì Prism đạt cùng mục tiêu với 0 dependency.
- **Shiki `css-variables` / `defaultColor:false`**: vẫn sinh `style=` nội tuyến → vi phạm CSP.
