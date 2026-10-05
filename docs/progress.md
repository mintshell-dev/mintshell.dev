# Tiến độ

Quỹ thời gian: 5–10 giờ/tuần, mỗi mốc khoảng 1 tuần. Định nghĩa hoàn thành: [workflow.md](workflow.md).

**Tiếp theo: M4 — đồng bộ Notion thủ công.**

| Mốc | Mục tiêu                                                  | Trạng thái | ADR                                                                          |
| --- | --------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| M0  | Khung monorepo                                            | Xong       | [0001](adr/0001-typescript-monorepo.md)–[0005](adr/0005-lint-format-test.md) |
| M1  | Design token                                              | Xong       | [0006](adr/0006-design-token-pipeline.md)                                    |
| M2a | Layout chung, menu, chuyển theme và ngôn ngữ              | Xong       | [0007](adr/0007-layout-theme-url.md)                                         |
| M2b | Portfolio và hiệu ứng                                     | Xong       | [0008](adr/0008-portfolio-data-css-motion.md)                                |
| M3a | Khung write-up (collection, trang, tô màu cú pháp)        | Xong       | [0009](adr/0009-writeup-content-model.md)                                    |
| M3b | Pagefind, RSS, trang chủ                                  | Xong       | [0010](adr/0010-search-feed.md)                                              |
| M3c | Callout, sơ đồ chuỗi tấn công, ảnh cover OG               | Xong       | [0012](adr/0012-mdx-components-og-image.md)                                  |
| M3  | Nội dung (bài thật)                                       | Đang làm   | —                                                                            |
| M4  | Đồng bộ Notion (thủ công)                                 | Tiếp theo  | —                                                                            |
| M5  | CI/CD, security headers, security.txt                     | Chưa làm   | —                                                                            |
| M6  | Email Brevo, chính sách quyền riêng tư, analytics, ra mắt | Chưa làm   | —                                                                            |

## Mốc đã xong (tóm tắt)

Chi tiết nguyên văn từng mốc: [history/m0-m3.md](history/m0-m3.md).

- **M0**: Dev Container có tường lửa, gitleaks + `prettier --check` ở pre-commit, pnpm + Turborepo, lint/format/test, `minimumReleaseAge` + `allowBuilds`.
- **M1**: token W3C → `tokens.css`/`tokens.ts` bằng script tự viết, theme tối/sáng, test tương phản WCAG AA, font tự host.
- **M2a**: `BaseLayout` (canonical, hreflang), header/footer, đổi theme chống nháy, đổi ngôn ngữ, URL không `/` cuối, i18n trong `packages/shared`, bộ kiểm tra `test:dist`.
- **M2b**: portfolio dữ liệu YAML + Zod, hiệu ứng chỉ CSS, bộ nhận diện (favicon, `BrandMark`).
- **M3a**: collection `writeups` + schema strict, trang danh sách/chi tiết, en `pending`, Prism không `style=`, chặn flag chưa che và HTML nguy hiểm trong `test:dist`.
- **M3b**: Pagefind tĩnh, RSS vi/en, trang chủ thật, fixture draft.
- **M3c**: `Callout`, `AttackChain`, ảnh OG sinh lúc build (sharp, cache theo nội dung), `TITLE_MAX = 120`.

## M4 — Đồng bộ Notion (thủ công)

Chạy bằng tay trên máy, không CI. Checklist chi tiết sẽ chốt khi lập kế hoạch M4.

- [ ] `scripts/notion-pull.ts`: kéo các bài trạng thái "Ready" bằng token Notion chỉ-đọc, lưu vào
      `content/writeups/_import/` (collection bỏ qua thư mục `_`, ADR 0009); site không gọi Notion lúc chạy
- [ ] Token chỉ nằm trên máy (biến môi trường), không CI, không commit; gitleaks phải qua
- [ ] `_import/` vào `.gitignore`: nháp có thể còn flag/IP chưa che
- [ ] Script quét và cảnh báo flag (`THM{…}`, `HTB{…}`…) và địa chỉ IP trong file vừa kéo về
- [ ] Xử lý thủ công như bài ValenFind: chuyển sang `content/writeups/<slug>/{vi,en}.mdx`, frontmatter theo
      `apps/web/src/schemas/writeup.ts` (sai schema → build lỗi), slug ASCII vĩnh viễn
- [ ] Nội dung Notion là dữ liệu không tin cậy: `inline.check` chặn `on*=`/thẻ nguy hiểm; cân nhắc `rehype-sanitize`
- [ ] Tự gắn `rel="noopener noreferrer"` cho link ngoài trong thân MDX (hoãn từ M3a, review M3c L3)
- [ ] Ảnh từ Notion tải về cùng bài (URL Notion có hạn), dùng `astro:assets`, `alt` bắt buộc, bỏ metadata
- [ ] Client Notion: `fetch` thẳng API (0 dependency) hay `@notionhq/client` (phải hỏi trước, ghim `catalog:`)
- [ ] Unit test chuyển đổi Notion → MDX và bộ quét flag/IP; `test:dist` vẫn qua
- [ ] ADR cho quy trình đồng bộ Notion
- [ ] Review bảo mật (security-reviewer)

## Việc còn mở từ các mốc đã xong

Chép nguyên văn từ chi tiết mốc.

### M2b

- [ ] Chờ dữ liệu thật: số phòng TryHackMe, số write-up, số báo cáo bug bounty, chứng chỉ, URL GitHub/YouTube/HackerOne, link CV, fingerprint PGP, URL dự án video và cộng đồng
- [ ] Duyệt bản tiếng Anh của `content/portfolio/en.yaml`

### M3a

- [ ] **Hoãn sang M4** (đã chốt): tự gắn `rel`/`target` cho link ngoài trong _thân_ MDX. Astro 7
      dùng Sätteri nên rehype/remark plugin cần cài `@astrojs/markdown-remark` (không "0 dep"); sẽ
      cân nhắc cùng `rehype-sanitize` khi thêm pipeline nội dung Notion ở M4. - Khoảng trống: link ngoài trong thân MDX chưa tự có `rel="noopener noreferrer"` (metadata
      `roomUrl` thì đã có). - Rủi ro hiện tại: thấp (chỉ reverse tabnabbing; nội dung trong Git là tin cậy). - Phòng tuyến tạm: CSP ở M5; xử lý dứt điểm ở M4 cùng `rehype-sanitize`. - Viết bài thủ công: nếu muốn chắc, tự thêm `rel` vào thẻ `<a>` cho link ngoài.
- [ ] Chưa làm: trang theo tag, bình luận

### M3b

- [ ] Chưa làm (đã chốt): trang theo tag, bình luận, sitemap (M5)

### M3c

- [ ] Giới hạn cache OG (M5/tương lai): CI cần giữ `apps/web/node_modules/.cache/og` giữa các lần chạy mới có lợi;
      cache không tự dọn ảnh mồ côi (xóa thư mục bất kỳ lúc nào là an toàn)
- [ ] Vite cảnh báo `MODULE_LEVEL_DIRECTIVE "use astro:head-inject"` khi MDX dùng component có style: chỉ là cảnh
      báo (CSS vẫn được nạp, đã kiểm tra); xem lại khi nâng Astro
- [ ] Thử chia sẻ link (trình xem trước OG) sau khi deploy (M5)
- [ ] Chưa làm (đã chốt): trang theo tag, cheatsheet, phân tích CVE, `og:type=article`/`article:*` (M5)

## Bảo trì

- [x] Vá GHSA-ch52-4w7c-c8xp: pnpm override `http-cache-semantics@<4.3.0: ^4.3.0` trong
      `pnpm-workspace.yaml`; chờ bản 4.3.0 đủ 1 ngày tuổi, không dùng `minimumReleaseAgeExclude`
      ([ADR 0011](adr/0011-override-http-cache-semantics.md))
- [ ] Gỡ override khi nâng Astro lên bản tự dùng http-cache-semantics >=4.3.0, chạy lại `pnpm audit`

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
- [ ] Pagefind (ADR 0010): luật `_headers` riêng cho `/search`, `/en/search`, `/pagefind/*` với `script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`, `connect-src 'self'`; trang khác KHÔNG có `wasm-unsafe-eval`; thử trên preview với CSP thật, xem console worker có chạy
- [ ] `X-Content-Type-Options: nosniff` (cả `rss.xml`); chạy `pnpm audit` trước khi merge
- [ ] Cache ảnh OG trong CI (ADR 0012, review M3c L2): khóa cache theo nhánh (`$CI_COMMIT_REF_SLUG`), job deploy
      `main`/protected build sạch không dùng cache OG (chống cache poisoning từ MR)
- [ ] Sitemap (hoãn từ M3b)
- [ ] Cache turbo không dọn `dist` khi cache hit: file thừa từ lần build trước (vd. trang draft) có
      thể còn lại trên máy local. CI phải build từ checkout sạch; local khi nghi ngờ thì `rm -rf apps/web/dist`
