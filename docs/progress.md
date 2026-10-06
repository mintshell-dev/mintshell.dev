# Tiến độ

Quỹ thời gian: 5–10 giờ/tuần, mỗi mốc khoảng 1 tuần. Định nghĩa hoàn thành: [workflow.md](workflow.md).

**Tiếp theo: duyệt M4, rồi chạy thử `notion:pull` với 1 bài thật.**

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
| M4  | Đồng bộ Notion (thủ công)                                 | Chờ duyệt  | [0013](adr/0013-notion-manual-pull.md)                                       |
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

`pnpm notion:pull` kéo bài Ready về `_import/` để soát, không xuất bản ([ADR 0013](adr/0013-notion-manual-pull.md));
hướng dẫn chạy trong [workflow.md](workflow.md).

- [x] `content/writeups/_import/` vào `.gitignore` trước tiên (nháp có thể còn flag/IP chưa che); `git check-ignore` xác nhận
- [x] `scripts/notion-pull.ts` + `scripts/notion/*`: `fetch` thẳng Notion API (0 dependency), `Notion-Version 2022-06-28`,
      lọc Status = Ready (cột kiểu status hoặc select), phân trang đủ, retry 429/5xx, timeout, đệ quy block tối đa 8 tầng
- [x] Token chỉ trong `.env` (`node --env-file-if-exists`), `.env.example` chỉ có tên biến; thiếu biến → báo tên và dừng;
      token không bao giờ bị in (test với server lặp lại token trong lỗi)
- [x] Block → Markdown: heading (lùi một cấp), đoạn, code (giữ ngôn ngữ), danh sách, to-do, trích dẫn, callout, ảnh,
      bảng, divider; block lạ → `[chưa hỗ trợ: <type>]`, vẫn giữ nội dung con; escape `{ } <`… cho MDX (đã thử trên
      Astro thật: `\{1+1\}` và `\<img onerror>` hiện nguyên chữ)
- [x] Frontmatter từ các cột, `draft: true`, `translation: pending`, `[[THIẾU MÔ TẢ]]`, `retired` cần xác nhận cho
      HackTheBox; hằng số so khớp `writeup.ts` và chạy qua `writeupSchema` thật trong test
- [x] Slug kiểm như collection; sai/trùng → bỏ qua + cảnh báo; `_import/<slug>/` đã có → bỏ qua trừ khi `--force`
      (bản cũ chỉ bị xóa sau khi lấy được nội dung mới); slug đã xuất bản → cảnh báo
- [x] Ảnh: tải về `images/01-…`, chỉ https, ≤ 10 MiB, magic bytes PNG/JPEG/GIF/WebP, từ chối SVG, không gửi token tới
      host ảnh, không chép URL S3 có chữ ký; caption → alt, thiếu → `[[THIẾU ALT]]`
- [x] Quét (chỉ báo): flag chưa che, mọi IPv4 có nhãn, **mọi** `user@host`/`㉿` trong code, metadata ảnh; báo cáo bảng +
      `file:dòng` + danh sách ảnh; dòng **TỔNG KẾT** luôn ở cuối kèm "CHƯA xuất bản gì"
- [x] Lệnh `notion:pull` ở `package.json` gốc, không vào turbo/CI; `tsc -p scripts` vào `pnpm typecheck`;
      `@types/node` (`catalog:`, đã có trong lockfile) vào devDependencies gốc
- [x] Turbo: `apps/web/turbo.json` loại `content/writeups/_import/**` khỏi inputs của `build` (glob tường minh không
      tôn trọng `.gitignore`: trước đó thêm một file nháp làm `web:build` cache miss); đã thử: nháp → cache hit, sửa
      bài thật → miss
- [x] 100 unit test trong `scripts/notion/` (gồm end-to-end với Notion giả và thư mục tạm); không gọi Notion thật
- [x] Hướng dẫn trong `docs/workflow.md` (tường lửa 2 host do tác giả tự thêm, chạy trong container ở terminal riêng tách khỏi Claude Code, checklist chuyển
      bài); ADR 0013
- [x] Review bảo mật (security-reviewer): không có Critical. Đã sửa: **H1** dòng `import`/`export` sẽ thành ESM chạy lúc
      build khi đổi sang `.mdx` → vô hiệu bằng character reference + cảnh báo (đã thử trên Astro thật; ADR 0013 đính
      chính); **M1** quét `user@host` trên toàn văn bản (cả inline code, email), thêm chuỗi 32 hex (flag HTB), đường
      dẫn home, cảnh báo mention người dùng Notion; **M2** (một phần) theo chuyển hướng thủ công, chỉ https, chặn
      localhost/IP nội bộ (cả `2130706433`, `0x7f.1`)/IPv6 literal trước khi gửi request; **L1** escape emoji callout
      và lý do ảnh lỗi; **L2** lọc ký tự điều khiển terminal trong báo cáo; **L3** bỏ href tới URL S3 có chữ ký;
      **L4** metadata GIF, byte đệm JPEG; **L5** ghi nguyên tử (thư mục tạm → rename), lỗi tải ảnh giữa luồng không
      làm dừng run. **L6** không cần sửa: `gitleaks dir` trên `scripts/` và `.env.example` không thấy gì
- [x] Ảnh `external` mặc định KHÔNG tải (lộ IP cho host lạ), ghi chú `[[ẢNH EXTERNAL KHÔNG TẢI: url]]`, cờ
      `--external-images` để bật; ảnh Notion (S3) vẫn tải; báo cáo có cột/tổng riêng
- [x] Thống nhất câu chữ ADR 0013 + `workflow.md`: chạy trong Dev Container, ở terminal riêng tách khỏi Claude Code
      (không phải ngoài container)
- [x] Viết sẵn hook `no-notion-import` (`language: fail`, chặn cả `git add -f` vào `_import/`) trong ADR 0013; đã thử
      bằng bản chép cấu hình ở `/tmp`
- [x] Tường lửa mở cố định 2 host Notion (`api.notion.com`, `prod-files-secure.s3…`), tác giả thêm ở `5ce04e0`;
      lý do (rủi ro chính là dữ liệu đi ra ngoài, tương đương gitlab.com/api.anthropic.com) ghi trong ADR 0013
- [x] Tác giả tự dán hook `no-notion-import` vào `.pre-commit-config.yaml` (agent không sửa file này)
- [x] Tác giả chạy thật lần đầu: `pnpm notion:pull` trong container ở terminal riêng (tách khỏi Claude Code) với 1 bài Ready, chuyển bài theo
      checklist trong `workflow.md`
- [ ] Chưa làm (còn mở): quét IPv6; `rehype-sanitize`; tự gắn `rel="noopener noreferrer"` cho link ngoài trong thân MDX (hoãn từ
      M3a, review M3c L3); bản `en`

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
