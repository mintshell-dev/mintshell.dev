# Tiến độ

Quỹ thời gian: 5–10 giờ/tuần, mỗi mốc khoảng 1 tuần.

| Mốc | Mục tiêu                                                  | Trạng thái |
| --- | --------------------------------------------------------- | ---------- |
| M0  | Khung monorepo                                            | Xong       |
| M1  | Design token                                              | Xong       |
| M2  | Layout + portfolio                                        | Chưa làm   |
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

## Ghi chú cho M2

- `color.border` chỉ đạt khoảng 1.2–1.3:1. Nếu viền là ranh giới duy nhất của ô nhập liệu hay control thì cần ≥ 3:1 (WCAG 1.4.11): thêm token viền đậm hơn hoặc dùng nền/outline khác.
- Nút chuyển theme cần script chặn nháy theme (đặt `data-theme` trước khi trang hiển thị), đồng thời phải tương thích CSP ở M5.
