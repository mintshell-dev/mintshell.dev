# Yêu cầu — giai đoạn 1

## Mục tiêu

Website cá nhân `mintshell.dev` chia sẻ kiến thức pentest ứng dụng web, dưới handle **mintshell** (không tên thật). Đối tượng: người học và người làm bảo mật web, đọc tiếng Việt hoặc tiếng Anh.

## Phạm vi giai đoạn 1

- **Nội dung**: write-up CTF, cheatsheet, trang portfolio — viết bằng MDX, lưu trong Git.
- **Song ngữ**: tiếng Việt ở `/`, tiếng Anh ở `/en` (xem [ADR 0004](adr/0004-bilingual-vi-root.md)).
- **Tìm kiếm**: Pagefind (tĩnh, chạy phía client).
- **RSS**: feed cho mỗi ngôn ngữ.
- **Giao diện**: phong cách "Terminal tinh tế", mặc định tối, có chế độ sáng (xem [design-system.md](design-system.md)).
- **Đồng bộ Notion** (M4): soạn nháp trong Notion, đồng bộ về MDX trong Git.
- **Bảo mật**: security headers, CSP chặt, `/.well-known/security.txt`.
- **Newsletter**: Brevo, double opt-in.
- **Analytics**: Cloudflare Web Analytics (không cookie).
- **Pháp lý**: trang chính sách quyền riêng tư (vi + en).

## Non-goals (ngoài phạm vi giai đoạn 1)

- Backend, API, cơ sở dữ liệu riêng.
- Bình luận (để giai đoạn 2).
- Tài khoản người dùng, đăng nhập.
- CMS chạy trên web.
- Tên thật hoặc thông tin định danh cá nhân.
- Quảng cáo, tracking bên thứ ba, tải tài nguyên từ CDN bên ngoài (gồm Google Fonts).

## Quyết định đã chốt

| Hạng mục             | Quyết định                                                              | ADR                                      |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| Ngôn ngữ & monorepo  | TypeScript, pnpm + Turborepo                                            | [0001](adr/0001-typescript-monorepo.md)  |
| Frontend             | Astro + React islands, MDX, Pagefind, RSS; font tự host                 | [0002](adr/0002-astro-frontend.md)       |
| Repo, CI/CD, hosting | GitLab (nguồn chính) + mirror GitHub, GitLab CI, Cloudflare Pages       | [0003](adr/0003-gitlab-ci-cloudflare.md) |
| Đa ngôn ngữ          | vi ở `/`, en ở `/en`, slug chung, `translation: pending\|done`          | [0004](adr/0004-bilingual-vi-root.md)    |
| Lint, format, test   | ESLint flat, Prettier, Vitest; pnpm `minimumReleaseAge` + `allowBuilds` | [0005](adr/0005-lint-format-test.md)     |
| Nhánh                | `main` được bảo vệ, mọi thay đổi qua Merge Request                      | —                                        |
| Analytics            | Cloudflare Web Analytics                                                | —                                        |
| Newsletter           | Brevo, double opt-in                                                    | —                                        |
| Bình luận            | Giai đoạn 2                                                             | —                                        |
| Giấy phép            | Code MIT, nội dung CC BY 4.0                                            | —                                        |
| Commit               | Conventional Commits, ký SSH, email `hi@mintshell.dev`                  | —                                        |
| Môi trường dev       | Dev Container có tường lửa; pre-commit chạy gitleaks                    | —                                        |
| Thời gian            | 5–10 giờ/tuần, mỗi mốc ~1 tuần                                          | —                                        |
