# ADR 0010 — Tìm kiếm Pagefind và feed RSS

Ngày: 2026-10-04 · Trạng thái: Đã chấp nhận · Mốc: M3b

## Bối cảnh

M3b cần tìm kiếm write-up và feed RSS mà vẫn giữ giai đoạn 1 **không backend**, CSP M5 chỉ
`'self'` (không script/style nội tuyến, không `style=`), màu/font chỉ từ token, song ngữ vi/en.

## Quyết định

### Pagefind là bước hậu build riêng

- `pagefind` (devDependency, binary qua `optionalDependencies` `@pagefind/<os>-<cpu>`, **không
  install script** → không đụng `allowBuilds`).
- `apps/web/scripts/search-index.ts` dùng Node API của Pagefind: index `dist/`, ghi
  `dist/pagefind/`, thoát lỗi nếu Pagefind báo lỗi. Turbo task `search:index` `dependsOn: build`,
  `test:dist` `dependsOn: search:index`; `pnpm build` ở gốc chạy cả hai (bản deploy luôn có index).
- Chỉ index nội dung thật: `data-pagefind-body` chỉ gắn vào `<article>` write-up không phải
  fixture. Khi có trang mang thuộc tính này, Pagefind bỏ qua mọi trang khác. Bản en `pending`
  không render `<article>`; draft không build ở production. Mục lục, khối meta, PrevNext có
  `data-pagefind-ignore`. Pagefind tách index theo `<html lang>` nên `/search` chỉ trả bài vi.

### UI tự dựng trên Pagefind JS API, không dùng UI mặc định

- UI mặc định (`pagefind-ui`) mang CSS màu/font riêng (trái quy ước token) và tự dựng DOM
  ngoài tầm kiểm soát. Thay vào đó: `<input type="search">` + script Astro (bundle thành file
  ngoài) `import()` động `/pagefind/pagefind.js` cùng origin.
- Render bằng DOM API, không `innerHTML`: excerpt chỉ nhận `<mark>`, phần còn lại thành chữ qua
  `textContent`; URL kết quả phải là đường dẫn cùng origin (`/x`, không `//`, `\`, scheme), bỏ
  đuôi `.html` (ADR 0007). Có unit test.
- Script index **xóa bundle UI mặc định** (`pagefind-ui*`, `modular-ui`, `component-ui`) khỏi
  `dist/pagefind`: không deploy JS/CSS bên thứ ba không dùng.
- Không dùng `<form>` (không có gì để gửi; `inline.check` chặn `<form>`); `<noscript>` dẫn về
  danh sách write-up.

### RSS theo ngôn ngữ

- `@astrojs/rss`: `/rss.xml` (vi), `/en/rss.xml` (en); write-up công khai (không draft, không
  fixture), feed en bỏ thêm bản `translation: pending`; mới nhất trước; link tuyệt đối
  `https://mintshell.dev`, không `/` cuối.
- `lib/feed.ts` là hàm thuần (`toFeedItems`, `feedOptions`), không phụ thuộc `astro:content`, để
  unit test bơm dữ liệu độc (`& < > "`, thẻ giả, `]]>`) qua đúng `getRssString` và xác nhận XML
  hợp lệ, có entity, parse lại đúng chuỗi gốc. Dữ liệu độc chỉ nằm trong test, không trong content.
- `BaseLayout` khai báo `<link rel="alternate" type="application/rss+xml">` trỏ feed cùng ngôn
  ngữ (không có `hreflang`, tách khỏi cặp alternate SEO).
- `fast-xml-parser` (đã có trong cây qua `@astrojs/rss`, cùng phiên bản) làm devDependency để
  `test:dist`/unit test validate XML. `XMLValidator` bị đánh dấu deprecated ở 5.11 (khuyên dùng gói
  `fast-xml-validator`); giữ lại vì vẫn hoạt động và không kéo mã mới — xem lại khi nâng cấp.

## Hệ quả

- **CSP M5**: Pagefind chạy WebAssembly trong Web Worker cùng origin. `'wasm-unsafe-eval'` chỉ
  áp cho `/search`, `/en/search` và `/pagefind/*` (luật `_headers` riêng, kèm `worker-src 'self'`,
  `connect-src 'self'`); các trang khác giữ `script-src 'self'`. Worker nhận CSP từ response của
  chính `/pagefind/pagefind-worker.js`: thiếu quyền ở `/pagefind/*` thì Pagefind lặng lẽ chạy trên
  main thread → kiểm tra console khi thử với CSP thật.
- **Chống index lan rộng**: không trang nào có `data-pagefind-body` thì Pagefind index cả site.
  `search-index.ts` chỉ quét `{writeups,en/writeups}/*.html`, dừng nếu không có trang mang thuộc
  tính, và đối chiếu `page_count` với số trang mang thuộc tính; lệch thì build lỗi.
- `dist/pagefind` chỉ giữ file lõi theo allowlist (bỏ UI, `pagefind-highlight.js`).
- Feed lọc ký tự điều khiển C0 không hợp lệ trong XML 1.0. `XMLValidator` **không** bắt nhóm này
  (đã thử), nên unit test kiểm tra thẳng trên XML thô.
- `astro dev` không có chỉ mục: trang tìm kiếm báo cần `pnpm build` + `pnpm --filter web preview`.
- Fixture `sample-draft` (draft, không fixture) chứng minh bộ lọc draft độc lập với `fixture`.
- Dependency mới: `pagefind`, `@astrojs/rss`, `fast-xml-parser` (dev), ghim trong `catalog:`.
