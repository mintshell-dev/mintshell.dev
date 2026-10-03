# ADR 0008 — Dữ liệu trang bằng YAML + schema, hiệu ứng chỉ bằng CSS

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh

Trang portfolio (M2b) có nhiều nội dung có cấu trúc (số liệu, kỹ năng, dự án, chứng chỉ, link), cần song ngữ, chưa có dữ liệu thật (dùng chỗ giữ chỗ) và sẽ được sửa thường xuyên. Trang có hiệu ứng (trượt lên, terminal gõ chữ, hiện dần khi cuộn), nhưng CSP ở M5 chỉ cho `'self'`: không script/style nội tuyến, không thuộc tính `style=`. Trang phải đọc được đủ khi tắt JavaScript và khi bật giảm chuyển động.

## Các phương án

Dữ liệu:

1. **YAML trong `content/portfolio/<locale>.yaml` + content collection + schema Zod (`astro/zod`).**
2. Viết thẳng trong component `.astro` — trộn nội dung với code, không kiểm tra được.
3. MDX — hợp với văn bản dài, kém hợp với dữ liệu dạng danh sách/số liệu.

Hiệu ứng:

1. **Chỉ CSS**: keyframes, `steps()`, `animation-timeline: view()` trong `@supports`.
2. Thư viện JS (GSAP, Motion…) — thêm dependency, cần JS, khó giữ CSP và trạng thái khi tắt JS.
3. IntersectionObserver tự viết — vẫn cần JS và phải ẩn nội dung trước bằng CSS (mất nội dung khi JS lỗi).

## Quyết định

- Dữ liệu trang portfolio là YAML theo locale trong `content/`, nạp bằng `glob` loader; schema đặt ở `apps/web/src/schemas/` (không ở `packages/shared`, để `shared` không cần zod). Object `strict`, URL chỉ `https://`, email hợp lệ, terminal đúng 3 dòng, lệnh ≤ 24 ký tự. Sai schema → build lỗi.
- Trường tùy chọn (`cvUrl`, URL mạng xã hội, URL dự án, `pgp`) thiếu thì phần tương ứng không render. Danh sách ghi nhận được phép rỗng; khi rỗng thì ẩn cả phần "// ghi nhận".
- Hiệu ứng chỉ bằng CSS. Trạng thái gốc là trạng thái cuối; animation chỉ khai báo trong `prefers-reduced-motion: no-preference` với `fill-mode: both`; scroll-driven animation bọc trong `@supports`.
- Độ trễ, số bước gõ đặt bằng class trong stylesheet (`.rise-N`, `.cmd-N`, `.out-N`) và custom property khai báo trong CSS, không bao giờ qua `style=`.
- Token mới cho cỡ chữ hiển thị, line-height (`$type: number`), easing (`$type: cubicBezier`); generator mở rộng allowlist tương ứng. Breakpoint `48rem` ghi thẳng trong `@media` (CSS variable không dùng được trong media query).

## Hệ quả

- Sửa nội dung không cần đụng code; build bắt lỗi dữ liệu sớm; `test:dist` so khớp số hàng giữa vi và en.
- Không thêm dependency, không thêm JS; CSP M5 giữ được `'self'`.
- Tốc độ gõ của terminal cố định theo ký tự, lệnh ngắn gõ xong thì chờ; số lệnh cố định 3 vì độ trễ nằm trong stylesheet.
- Trình duyệt chưa hỗ trợ scroll-driven animation (hiện là Firefox) thấy nội dung tĩnh, không có hiệu ứng cuộn.
- Thêm phần dữ liệu khác (trang chủ ở M3) nên theo cùng mẫu: YAML theo locale + schema.
