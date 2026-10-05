# Quy trình làm việc

Lệnh, quy ước và định nghĩa hoàn thành. Luật bảo mật và quy trình bắt buộc nằm trong [CLAUDE.md](../CLAUDE.md).

## Stack

TypeScript · pnpm + Turborepo · Astro + React islands · nội dung MDX trong Git · Pagefind · RSS · Cloudflare Pages · GitLab CI. Giai đoạn 1 **không có backend**.

## Lệnh (có từ khi xong M0)

```sh
pnpm install            # cài dependency
pnpm dev                # chạy dev server
pnpm build              # build toàn bộ
pnpm lint               # lint
pnpm typecheck          # kiểm tra kiểu
pnpm test               # chạy unit test
pnpm test:dist          # build rồi kiểm tra bản build (apps/web/dist)
pnpm format:check       # kiểm tra định dạng (pnpm format để sửa)
pnpm --filter web <lệnh>  # chạy lệnh cho một gói
```

## Quy ước

- Chỉ dùng design token (CSS variables từ `packages/tokens`); không ghi cứng màu, font, spacing.
- Mọi chuỗi giao diện phải có đủ `vi` và `en`.
- Slug đã xuất bản là vĩnh viễn; dùng chung cho cả hai ngôn ngữ.
- Commit theo Conventional Commits, ký SSH, email `hi@mintshell.dev`.
- `main` được bảo vệ; mọi thay đổi qua Merge Request.

## Định nghĩa hoàn thành

1. `lint`, `typecheck`, `test`, `build`, `test:dist`, `format:check` đều qua.
2. Cập nhật `docs/progress.md`.
3. Thêm ADR trong `docs/adr/` khi có quyết định kiến trúc.
