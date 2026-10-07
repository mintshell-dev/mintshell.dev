# ADR 0015 — Sitemap tự sinh, hreflang theo bản có thật, og:type article

Ngày: 2026-10-07 · Trạng thái: Đã chấp nhận · Mốc: M6a-2

## Bối cảnh

Site có 11 write-up công khai, 3 bài có cả vi/en, 8 bài chỉ có en (`vi.mdx` để `draft: true` cho tới khi dịch xong,
chiến lược đã chốt ở mục "Lọc danh sách write-up theo bản ngôn ngữ" trong `progress.md`). Chưa có sitemap, robots.txt,
mọi trang đều `og:type=website`. Khảo sát thấy thêm hai lỗi:

- `BaseLayout` luôn phát `hreflang` vi + en + `x-default → vi`. Với 8 bài chỉ có en, `hreflang="vi"` và `x-default`
  trỏ tới `/writeups/<slug>`, trang không được build (404). Google bỏ qua cả cụm hreflang khi có URL hỏng.
- Trang fixture (`sample-writeup`, `sample-pending` vi) được build để `test:dist` soi nhưng index được (có canonical).

## Quyết định

### Sitemap: endpoint tự viết, không dùng `@astrojs/sitemap`

- `src/pages/sitemap.xml.ts` sinh `/sitemap.xml` lúc build từ `STATIC_PATHS` (`src/lib/seo.ts`) và `listWriteups()`.
  Write-up dùng đúng `isListed`, nên sitemap, danh sách, trang chủ, prev/next và RSS cùng một quy tắc: không draft,
  không fixture, không bản `pending`.
- Mỗi bản ngôn ngữ một `<url>`. Bản có cặp liệt kê `xhtml:link` hreflang cho mọi bản + `x-default`; bản lẻ không có
  hreflang. `<lastmod>` = `updated ?? date` cho write-up; trang tĩnh không có (không bịa ngày). Không
  `priority`/`changefreq` (Google bỏ qua).
- **Vì sao không `@astrojs/sitemap` 3.7.4**:
  1. Xuất `sitemap-index.xml` + `sitemap-0.xml`, không có `/sitemap.xml`.
  2. `filter` chỉ nhận chuỗi URL, `astro.config` chạy trước content layer nên không gọi được `isListed`. Muốn lọc phải
     tính lại draft/pending/fixture ở chỗ thứ hai, dễ lệch.
  3. Thêm `sitemap@9` + `zod` cho việc ~60 dòng code.
- Đánh đổi: trang tĩnh phải khai báo tay trong `STATIC_PATHS`. Bù bằng `test:dist`: tập `<loc>` phải **bằng đúng** tập
  canonical của mọi trang `.html` không `noindex` trong `dist` (quên khai báo trang mới, hoặc sitemap lọt trang không
  nên index, đều đỏ), và bằng tập tính độc lập từ frontmatter nguồn.

### hreflang chỉ cho bản có thật

- `BaseLayout` nhận `alternates` (mặc định mọi ngôn ngữ, cho trang tĩnh). Write-up truyền `listedLocales(slug)` (cùng
  `isListed`). `x-default` → vi nếu có, không thì en (`xDefault`, dùng chung cho HTML và sitemap). Thiếu ngôn ngữ của
  chính trang → build lỗi.
- `test:dist` kiểm mỗi hreflang trỏ tới trang index được có trong `dist`, quan hệ hai chiều.

### Index được ⇔ có ở danh sách công khai

Trang write-up chỉ index được khi bản ngôn ngữ của nó qua `isListed` (`noindex = !listedLocales(slug).includes(locale)`).
Vì vậy fixture (vẫn build để `test:dist` soi), bản en pending và bản vi pending (ở dev, hoặc lỡ `draft: false`) đều
`noindex`, không canonical/hreflang, không vào sitemap, như 404.

### robots.txt

Cho phép mọi thứ, chỉ `Disallow: /pagefind/` (mảnh chỉ mục tìm kiếm), `Sitemap: https://mintshell.dev/sitemap.xml`.
Không chặn 404/fixture/pending: chặn thì crawler không đọc được `noindex`. Không chặn `/og/` (trình xem trước link cần
ảnh). Không liệt kê path "bí mật" (robots.txt là công khai).

### og:type

Trang write-up có nội dung: `og:type=article`, `article:published_time` (`date`), `article:modified_time` (chỉ khi
có `updated`), cả hai chỉ ghi ngày `YYYY-MM-DD` (không lộ giờ viết bài), mỗi tag một `article:tag`. Trang khác (cả bản en pending): `website`. Thêm
`<link rel="sitemap" href="/sitemap.xml">` ở mọi trang.

## Hệ quả

- 0 dependency mới; không nới CSP hay `_headers`: sitemap và robots là file tĩnh, luật `/*` đã có nosniff. Đã thử
  `wrangler dev`: `/sitemap.xml` 200 `application/xml`, `/robots.txt` 200 `text/plain; charset=utf-8`, một CSP chung.
- Thêm trang tĩnh mới: thêm vào `STATIC_PATHS` và danh sách `STATIC` trong `test-dist/sitemap.check.ts`.
- Khi dịch xong bài en-only (đổi `vi.mdx` sang `draft: false`, `translation: done`), hreflang và sitemap tự có cặp.
- Chưa làm: JSON-LD `Article` (script nội tuyến, cần xem lại CSP), sitemap ảnh, gửi sitemap lên Search Console.
