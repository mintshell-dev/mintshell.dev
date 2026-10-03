# Tiến độ

Quỹ thời gian: 5–10 giờ/tuần, mỗi mốc khoảng 1 tuần.

## Định nghĩa hoàn thành

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:dist` đều qua.
2. Cập nhật `docs/progress.md`.
3. Thêm ADR trong `docs/adr/` khi có quyết định kiến trúc.

| Mốc | Mục tiêu                                                  | Trạng thái |
| --- | --------------------------------------------------------- | ---------- |
| M0  | Khung monorepo                                            | Xong       |
| M1  | Design token                                              | Xong       |
| M2a | Layout chung, menu, chuyển theme và ngôn ngữ              | Xong       |
| M2b | Portfolio và hiệu ứng                                     | Xong       |
| M3  | Nội dung, Pagefind, RSS                                   | Chưa làm   |
| M4  | Đồng bộ Notion                                            | Chưa làm   |
| M5  | CI/CD, security headers, security.txt                     | Chưa làm   |
| M6  | Email Brevo, chính sách quyền riêng tư, analytics, ra mắt | Chưa làm   |

## M0 — Khung monorepo

- [x] Dev Container có tường lửa
- [x] Pre-commit gitleaks
- [x] Tài liệu nền (CLAUDE.md, docs/, ADR 0001–0004)
- [x] Khung pnpm + Turborepo (`apps/web`, `packages/*`)
- [x] Lệnh lint, typecheck, test, build chạy được; dev server phục vụ `/` (vi) và `/en`
- [x] Công cụ lint/format/test và chính sách cài gói ([ADR 0005](adr/0005-lint-format-test.md)):
      `minimumReleaseAge` 1 ngày (strict), `allowBuilds` không cho phép gói nào, lockfile được commit

## M1 — Design token

- [x] Token W3C Design Tokens trong `packages/tokens/tokens/` (base, theme tối, theme sáng), thêm `color.onAccent`
- [x] Script TS tự viết sinh `dist/tokens.css` và `dist/tokens.ts` ([ADR 0006](adr/0006-design-token-pipeline.md))
- [x] `:root` là theme tối, `[data-theme="light"]` là theme sáng, `prefers-reduced-motion` đưa thời lượng chuyển động về 0
- [x] Severity tách theo theme (theme sáng dùng tông đậm)
- [x] Test Vitest: tương phản WCAG AA (chữ, severity, onAccent) ở cả hai theme; CSS sinh ra đủ biến
- [x] Font tự host bằng `@fontsource` (Be Vietnam Pro 400/500/600, JetBrains Mono 400/500), không có `data:` URI trong CSS
- [x] `apps/web`: `global.css` nạp token và font; nền, chữ, font dùng token
- [x] Review bảo mật: generator kiểm tra giá trị token theo allowlist (L1), `inlineStylesheets: 'never'` (L2)

## M2a — Layout chung, menu, chuyển theme và ngôn ngữ

- [x] `BaseLayout.astro`: `<html lang>` theo ngôn ngữ, `data-theme`, meta cơ bản + Open Graph, `canonical` và `hreflang` (vi, en, x-default → vi); trang 404 `noindex`
- [x] Header: handle mono `mintshell_` (dấu `_` màu accent), menu write-ups/cheatsheets/portfolio có `aria-current`, gạch chân chạy từ trái sang; trên di động menu tự xuống dòng
- [x] Nút đổi ngôn ngữ và nút đổi theme: vuông 44px (`size.control`), viền `color.borderStrong`, icon SVG nội tuyến, `aria-label` song ngữ
- [x] Footer: `© 2026 mintshell`, giấy phép MIT (code) và CC BY 4.0 (nội dung), chữ nhỏ, muted, mono
- [x] Trang tạm `/writeups`, `/cheatsheets`, `/portfolio` và bản `/en`; trang 404 vi (`404.html`) và en (`en/404.html`)
- [x] Chống nháy theme: `public/theme-init.js` chặn render trong `<head>` (đã lưu → hệ điều hành → tối), localStorage bọc try/catch; gắn `data-js` để chỉ hiện nút theme khi có JavaScript; test bằng `node:vm`
- [x] Không script/style nội tuyến trong HTML build (CSP M5 chỉ cần `'self'`); nút theme dùng script Astro, chưa thêm React ([ADR 0007](adr/0007-layout-theme-url.md))
- [x] i18n chuyển sang `packages/shared`: hàm thuần `localizePath` (`/x` ↔ `/en/x`, chặn `//host`) có test; từ điển chuỗi giao diện, test vi/en cùng tập khóa
- [x] URL không có `/` cuối: `trailingSlash: 'never'`, `build.format: 'file'` (ADR 0007)
- [x] Token mới: `color.borderStrong` (≥ 3:1 trên bg/surface ở cả hai theme, có test), `size.*`, `border.width.*`, `font.size.*`
- [x] Truy cập: link "Bỏ qua tới nội dung", `:focus-visible` dùng accent, điều hướng bàn phím, chuyển động tôn trọng `prefers-reduced-motion`
- [x] Không thêm dependency bên ngoài (chỉ liên kết nội bộ `@mintshell/shared`)
- [x] Sửa sau kiểm tra thủ công: dev server nghe `127.0.0.1`, khoảng trắng trong footer, bỏ `tabindex` trên `<main>`, dịch "mã nguồn"
- [x] Bộ kiểm tra bản build `pnpm test:dist` (turbo chạy `build` trước, Vitest config riêng `apps/web/vitest.dist.config.ts`, file `test-dist/*.check.ts`): không script/style/`style=` nội tuyến, không `data:` URI, CSS chỉ tham chiếu tài nguyên cùng origin, canonical/hreflang tuyệt đối không đuôi `.html`, footer đúng khoảng trắng, skip link, 404 song ngữ

## M2b — Portfolio và hiệu ứng

- [x] `/portfolio`, `/en/portfolio` bố cục kiểu tạp chí: hero hai cột + terminal giả, dải số liệu, cách làm việc, kỹ năng, việc đã làm, ghi nhận, liên hệ (`id="lien-he"`)
- [x] Dữ liệu trong `content/portfolio/{vi,en}.yaml`, content collection + schema Zod; sai schema thì build lỗi; URL chỉ `https://`; có unit test schema ([ADR 0008](adr/0008-portfolio-data-css-motion.md))
- [x] Phần "// hành trình" (sau dải số liệu, trước "cách tôi làm việc"): câu chuyện nghề nghiệp chỉ kể ở đây, hero intro chỉ giữ vai trò và giá trị; không có chi tiết định danh (tuổi, ngành cũ, nơi làm việc)
- [x] Nút "Tải CV", link mạng xã hội, dòng PGP chỉ hiện khi có dữ liệu; hàng dự án chỉ là link (có hover, ↗) khi có URL
- [x] Hiệu ứng chỉ CSS: hero trượt lên so le, terminal gõ chữ bằng `steps()`, hiện dần khi cuộn (`animation-timeline: view()` trong `@supports`), hover nút/hàng dự án; `prefers-reduced-motion` hiện ngay trạng thái cuối
- [x] Không `style=`, không JS cho hiệu ứng; terminal giả `aria-hidden`
- [x] Token mới: `font.size.2xl–5xl`, `font.lineHeight.*` (`$type: number`), `motion.easing.out` (`$type: cubicBezier`), `motion.duration.type`; generator kiểm tra allowlist cho hai `$type` mới
- [x] Header di động: handle và hai nút cùng hàng, menu xuống hàng hai
- [x] `test:dist` cho portfolio: email, `id="lien-he"`, không `style=`, chỉ 2 script, terminal ẩn, link ngoài https, hàng tĩnh không phải link, vi/en cùng số hàng
- [x] Xóa `BaseLayout.astro.save` bị commit nhầm; `.gitignore` thêm mẫu file tạm của trình soạn thảo
- [x] Đính chính dữ liệu cho trung thực: kinh nghiệm 6 năm (4 năm lập trình web, 2 năm bảo mật), TryHackMe 100k+ điểm, bỏ HackTheBox và Hall of Fame; danh sách ghi nhận được phép rỗng (rỗng thì ẩn phần "// ghi nhận")
- [x] Sửa cache turbo: `apps/web/turbo.json` thêm `content/**` vào đầu vào của `build` (trước đó sửa YAML vẫn `cache hit`, build và `test:dist` chạy trên dữ liệu cũ)
- [x] Bộ nhận diện: `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `theme-color` từ token; `test:dist` kiểm tra thẻ icon trên mọi trang và favicon SVG an toàn
- [x] Bỏ metadata C2PA khỏi favicon (PNG 7036 → 1266 B và 11424 → 5654 B, SVG 8409 → 635 B, pixel không đổi); `test:dist` chặn chunk metadata PNG và `<metadata>` SVG; `brand/` là nguồn gốc bộ nhận diện
- [x] `BrandMark.astro` (SVG nội tuyến, màu theo token, biến thể `mark`/`avatar`): header mọi trang và phần liên hệ portfolio; test tương phản đồ họa ≥ 3:1 và `test:dist` cho SVG nội tuyến
- [ ] Chờ dữ liệu thật: số phòng TryHackMe, số write-up, số báo cáo bug bounty, chứng chỉ, URL GitHub/YouTube/HackerOne, link CV, fingerprint PGP, URL dự án video và cộng đồng
- [ ] Duyệt bản tiếng Anh của `content/portfolio/en.yaml`

## M5 — CI/CD, security headers, security.txt

- [ ] CI chạy `lint`, `typecheck`, `test`, rồi `build` và `test:dist` trên bản build vừa tạo.

Kiểm tra trên bản preview Cloudflare Pages (do `build.format: 'file'`, ADR 0007):

- [ ] `/en` phục vụ `en.html`, `/en/writeups` phục vụ `en/writeups.html` (không xung đột giữa file `en.html` và thư mục `en/`).
- [ ] `/writeups.html` chuyển hướng về `/writeups`.
- [ ] Đường dẫn không tồn tại dưới `/en/` trả về `en/404.html`.

Security headers (`_headers`), CSP ngoài `default-src`/`script-src`/`style-src`/`font-src` `'self'` thêm (gợi ý từ review bảo mật M2a):

- [ ] `frame-ancestors 'none'`
- [ ] `base-uri 'none'`
- [ ] `object-src 'none'`
- [ ] `form-action 'self'` (M6: thêm domain Brevo cho form newsletter)
