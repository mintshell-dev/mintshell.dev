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

- **React islands** phía client: chuyển theme tối/sáng, ô tìm kiếm Pagefind.
- **Newsletter**: form gửi thẳng tới Brevo; Brevo gửi email xác nhận (double opt-in).
- **Analytics**: beacon Cloudflare Web Analytics.
- **Đồng bộ Notion (M4)**: script trong `scripts/` lấy trang từ Notion → sinh MDX vào `content/` → đưa vào Git qua Merge Request. Site không gọi Notion lúc chạy.

## Domain

- `mintshell.dev` (apex) là canonical.
- `www.mintshell.dev` → 301 về apex.
- Email liên hệ: `hi@mintshell.dev`.

## URL và slug

| Trang      | Tiếng Việt            | Tiếng Anh                |
| ---------- | --------------------- | ------------------------ |
| Trang chủ  | `/`                   | `/en/`                   |
| Write-up   | `/writeups/<slug>`    | `/en/writeups/<slug>`    |
| Cheatsheet | `/cheatsheets/<slug>` | `/en/cheatsheets/<slug>` |
| Portfolio  | `/portfolio`          | `/en/portfolio`          |
| RSS        | `/rss.xml`            | `/en/rss.xml`            |

Quy tắc slug:

- ASCII chữ thường, gạch nối, không dấu (vd. `sqli-blind-time-based`).
- Dùng chung cho cả hai ngôn ngữ.
- Đã xuất bản là **vĩnh viễn**; nếu buộc phải đổi thì thêm redirect 301.
- Mỗi trang có `canonical` và `hreflang` (vi, en, x-default → vi).
- Bản tiếng Anh có `translation: pending` hiển thị thông báo và liên kết sang bản tiếng Việt.

## Subdomain

- Giai đoạn 1: chỉ apex và `www`.
- Dự kiến giai đoạn 2: có thể thêm subdomain riêng cho bình luận/API — sẽ quyết bằng ADR khi tới.

## Cấu trúc monorepo

```
.
├── apps/
│   └── web/          # site Astro (trang, layout, React islands)
├── packages/
│   ├── tokens/       # design token (W3C) → CSS variables qua Style Dictionary
│   ├── ui/           # component dùng chung, chỉ dùng token
│   └── shared/       # kiểu, schema frontmatter, tiện ích, chuỗi i18n
├── content/          # nội dung MDX (CC BY 4.0)
├── scripts/          # script tiện ích (vd. đồng bộ Notion)
├── infra/            # cấu hình hạ tầng (headers, redirects, security.txt…)
└── docs/             # tài liệu, ADR, tiến độ
```

Hướng phụ thuộc: `apps/web` → `packages/ui` → `packages/tokens`; `packages/shared` dùng được ở mọi nơi. Gói trong `packages/` không phụ thuộc `apps/`.
