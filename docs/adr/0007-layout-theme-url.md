# ADR 0007 — Chuyển theme không dùng React, script chặn nháy từ file tĩnh, URL không có `/` cuối

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh

M2a dựng layout chung, nút chuyển theme và ngôn ngữ. Có ba ràng buộc:

- Theme phải được đặt **trước khi trang hiển thị**, nếu không người dùng chọn theme sáng sẽ thấy nháy theme tối.
- CSP ở M5 chỉ cho `'self'`: không script hay style nội tuyến, không hash/nonce.
- URL và slug là vĩnh viễn (ADR 0004), nên dạng URL (có hay không `/` cuối) phải chốt ngay. Cloudflare Pages tự 308 `/x` → `/x/` nếu trang build thành `x/index.html`.

## Các phương án

Chuyển theme:

1. **Script TypeScript nhỏ trong component Astro + `public/theme-init.js`** chặn render trong `<head>`.
2. React island cho nút theme — thêm React, runtime ~40 KB chỉ cho một nút; vẫn cần script chặn nháy riêng vì island hydrate sau khi vẽ.
3. Script nội tuyến trong `<head>` — chuẩn phổ biến nhưng cần `'unsafe-inline'` hoặc hash CSP.

URL:

1. **Không `/` cuối**: `trailingSlash: 'never'` + `build.format: 'file'` (`writeups.html`, `en.html`).
2. Luôn có `/` cuối: `trailingSlash: 'always'` + `format: 'directory'`.

## Quyết định

- Nút theme là component Astro, script TypeScript được Astro bundle thành file `.js`. **Chưa thêm React**; chỉ thêm khi có thành phần thật sự cần (dự kiến ô tìm kiếm), kèm ADR.
- `public/theme-init.js` nạp bằng `<script is:inline src="/theme-init.js">` (không `async`/`defer`). `is:inline` chỉ để Astro không bundle file trong `public/`; script vẫn là file ngoài nên CSP `script-src 'self'` đủ.
- Thứ tự theme: `localStorage['theme']` (chỉ nhận `light`/`dark`) → `prefers-color-scheme` → tối. Truy cập `localStorage` bọc try/catch.
- `<html data-theme="dark">` được render sẵn: không có JavaScript thì luôn là theme tối.
- `vite.build.assetsInlineLimit: 0` cũng ngăn Astro nhúng script nhỏ vào HTML; kiểm tra bằng cách quét `dist/**/*.html`.
- URL không `/` cuối: `/writeups`, `/en`, `/en/writeups`. Hàm `localizePath` (trong `packages/shared`) chuẩn hoá mọi pathname (bỏ `.html`, `/index`, `/` cuối, gộp `/` đầu) trước khi sinh `canonical`, `hreflang` và link.

## Hệ quả

- Không thêm dependency; JS phía client chỉ gồm `theme-init.js` (< 1 KB) và script nút theme.
- CSP M5 có thể giữ `script-src 'self'` và `style-src 'self'`.
- Không có JavaScript: trang ở theme tối mặc định và nút theme bị ẩn (`theme-init.js` gắn `data-js` lên `<html>`, CSS ẩn nút khi thiếu thuộc tính này).
- Logic chọn theme nằm ở hai nơi (`theme-init.js` thuần JS và `theme-toggle.ts`); khóa `localStorage` dùng chung được test ràng buộc.
- Trang 404 tách `404.html` (vi) và `en/404.html` (en), dựa vào việc Cloudflare Pages tìm `404.html` gần nhất theo thư mục.
- Dạng `format: 'file'` cần kiểm tra trên bản preview Cloudflare Pages ở M5 (`/en` ↔ `en.html` cạnh thư mục `en/`, redirect `/x.html` → `/x`, 404 dưới `/en/`), xem `docs/progress.md`.
