# Tiến độ

Quỹ thời gian: 5–10 giờ/tuần, mỗi mốc khoảng 1 tuần.

| Mốc | Mục tiêu                                                  | Trạng thái |
| --- | --------------------------------------------------------- | ---------- |
| M0  | Khung monorepo                                            | Xong       |
| M1  | Design token                                              | Chưa làm   |
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
