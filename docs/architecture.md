# Kiến trúc

## Tổng quan

Site tĩnh hoàn toàn (SSG), không backend ở giai đoạn 1. Git là nguồn sự thật cho cả code và nội dung.

## Luồng tĩnh (build & deploy)

```
content/*.mdx ──► Astro build (SSG) ──► HTML/CSS/JS ──► Pagefind index + RSS ──► Cloudflare Pages
```

Triển khai:

1. Mở Merge Request → GitLab CI chạy lint, typecheck, test, build → deploy bản preview.
2. Merge vào `main` → GitLab CI deploy production lên Cloudflare Pages.
3. GitLab push mirror sang GitHub.

## Luồng động (không có backend riêng)

- **Chuyển theme tối/sáng**: script nhỏ trong component Astro + `public/theme-init.js` chống nháy, không dùng React ([ADR 0007](adr/0007-layout-theme-url.md)).
- **Tìm kiếm**: Pagefind index sau build (`search:index`); trang `/search` là script Astro nhỏ gọi Pagefind JS API cùng origin, không React ([ADR 0010](adr/0010-search-feed.md)).
- **Newsletter**: form gửi thẳng tới Brevo; Brevo gửi email xác nhận (double opt-in).
- **Analytics**: beacon Cloudflare Web Analytics.
- **Đồng bộ Notion (M4)**: chạy thủ công trên máy, không CI. `scripts/notion-pull.ts` ([ADR 0013](adr/0013-notion-manual-pull.md)) dùng token chỉ-đọc kéo các bài "Ready" về `content/writeups/_import/` (gitignore, collection không nạp) và cảnh báo flag/IP chưa che → tác giả tự xử lý thành `content/writeups/<slug>/` → đưa vào Git qua Merge Request. Site không gọi Notion lúc chạy.

## Domain

- `mintshell.dev` (apex) là canonical.
- `www.mintshell.dev` → 301 về apex.
- Email liên hệ: `hi@mintshell.dev`.

## URL và slug

| Trang      | Tiếng Việt            | Tiếng Anh                |
| ---------- | --------------------- | ------------------------ |
| Trang chủ  | `/`                   | `/en`                    |
| Write-up   | `/writeups/<slug>`    | `/en/writeups/<slug>`    |
| Cheatsheet | `/cheatsheets/<slug>` | `/en/cheatsheets/<slug>` |
| Portfolio  | `/portfolio`          | `/en/portfolio`          |
| Tìm kiếm   | `/search`             | `/en/search`             |
| RSS        | `/rss.xml`            | `/en/rss.xml`            |

Quy tắc slug:

- ASCII chữ thường, gạch nối, không dấu (vd. `sqli-blind-time-based`).
- Dùng chung cho cả hai ngôn ngữ.
- Đã xuất bản là **vĩnh viễn**; nếu buộc phải đổi thì thêm redirect 301.
- Mỗi trang có `canonical` và `hreflang` (vi, en, x-default → vi).
- URL không có `/` cuối (`trailingSlash: 'never'`, `build.format: 'file'`), xem [ADR 0007](adr/0007-layout-theme-url.md).
- Bản tiếng Anh có `translation: pending` hiển thị thông báo và liên kết sang bản tiếng Việt.

## Subdomain

- Giai đoạn 1: chỉ apex và `www`.
- Dự kiến giai đoạn 2: có thể thêm subdomain riêng cho bình luận/API — sẽ quyết bằng ADR khi tới.

## Dữ liệu trang portfolio

- `content/portfolio/vi.yaml` và `en.yaml`, nạp bằng content collection `portfolio` (`apps/web/src/content.config.ts`, `glob` loader), id entry = locale.
- Schema Zod (`astro/zod`) ở `apps/web/src/schemas/portfolio.ts`, không đặt trong `packages/shared` để `shared` không phải thêm dependency zod. Sai schema hoặc thiếu file thì build lỗi.
- Mọi URL trong dữ liệu phải là `https://` (`cvUrl` được phép thêm path nội bộ `/…`). Link chưa có URL thì không hiển thị.
- Xem [ADR 0008](adr/0008-portfolio-data-css-motion.md).

## Môi trường dev

- Mọi lệnh chạy trong Dev Container.
- `astro dev` nghe `127.0.0.1` (`server.host` trong `apps/web/astro.config.ts`): mặc định Astro chỉ nghe `[::1]` (IPv6), còn kênh chuyển tiếp cổng của VS Code kết nối qua IPv4. Chỉ nghe loopback, nên dev server không mở ra mạng ngoài.
- `apps/web/turbo.json` khai báo `content/**` là đầu vào của task `build`: `content/` nằm ngoài gói `web`, nếu thiếu khai báo thì turbo dùng lại cache cũ khi chỉ sửa nội dung.
- Kiểm tra bản build: `pnpm test:dist` (turbo chạy `build` trước) đọc `apps/web/dist` để bắt script/style nội tuyến, `data:` URI, tài nguyên ngoài origin, canonical/hreflang sai.

## Cấu trúc monorepo

```
.
├── apps/
│   └── web/          # site Astro (trang, layout, React islands)
├── packages/
│   ├── tokens/       # design token (W3C) → CSS variables qua Style Dictionary
│   ├── ui/           # component dùng chung, chỉ dùng token
│   └── shared/       # kiểu, schema frontmatter, tiện ích, i18n (ngôn ngữ, path, từ điển)
├── content/          # nội dung MDX, dữ liệu trang (portfolio/*.yaml) (CC BY 4.0)
├── scripts/          # script tiện ích (vd. đồng bộ Notion)
├── infra/            # cấu hình hạ tầng (headers, redirects, security.txt…)
└── docs/             # tài liệu, ADR, tiến độ
```

Hướng phụ thuộc: `apps/web` → `packages/ui` → `packages/tokens`; `packages/shared` dùng được ở mọi nơi. Gói trong `packages/` không phụ thuộc `apps/`.
