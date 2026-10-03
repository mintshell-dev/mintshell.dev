# ADR 0003 — GitLab + GitLab CI + Cloudflare Pages

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh

Cần nơi lưu code, quy trình review, CI/CD và hosting tĩnh: miễn phí hoặc rẻ, có preview cho mỗi thay đổi, cho phép đặt security headers, và có CDN tốt cho người đọc ở Việt Nam lẫn quốc tế.

## Các phương án

1. **GitLab (nguồn chính) + GitLab CI + Cloudflare Pages**, mirror sang GitHub.
2. GitHub + GitHub Actions + Cloudflare Pages.
3. Netlify hoặc Vercel làm cả build lẫn hosting.
4. GitLab Pages.

## Quyết định

- Repo chính: GitLab `mintshell/mintshell.dev`; push mirror sang GitHub để dễ tìm thấy.
- `main` được bảo vệ, mọi thay đổi qua Merge Request.
- CI/CD: **GitLab CI** chạy lint, typecheck, test, build; deploy lên **Cloudflare Pages** (preview cho MR, production khi merge `main`).
- Analytics: Cloudflare Web Analytics.

## Hệ quả

- Build chạy trên GitLab CI, không phụ thuộc build của Cloudflare; cần token deploy Cloudflare lưu trong biến CI được bảo vệ (không bao giờ trong repo).
- Headers, redirects, `security.txt` quản lý trong `infra/` (M5).
- GitHub chỉ là bản sao; issue/MR xử lý trên GitLab.
- DNS và hosting cùng ở Cloudflare, dễ cấu hình apex/`www`.
