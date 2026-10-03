# ADR 0001 — TypeScript monorepo với pnpm + Turborepo

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh

Dự án gồm site (`apps/web`), design token, thư viện UI, tiện ích dùng chung và script. Cần chia sẻ code và kiểu giữa các phần, build nhanh, và chạy được trong quỹ thời gian 5–10 giờ/tuần của một người.

## Các phương án

1. **pnpm workspaces + Turborepo** — cài nhanh, tiết kiệm đĩa, phụ thuộc nghiêm ngặt; Turborepo cache task đơn giản.
2. npm/yarn workspaces không có task runner — đơn giản nhưng không cache, phải tự sắp thứ tự build.
3. Nx — mạnh nhưng nặng cấu hình, quá mức cần cho dự án cá nhân.
4. Polyrepo — tách repo, khó đồng bộ thay đổi giữa token/UI/site.

Ngôn ngữ: TypeScript so với JavaScript thuần — TypeScript bắt lỗi sớm, kiểm tra schema frontmatter và chuỗi i18n.

## Quyết định

Dùng **TypeScript** cho toàn bộ code, monorepo **pnpm workspaces + Turborepo**, cấu trúc `apps/`, `packages/`, `content/`, `scripts/`, `infra/`, `docs/`.

## Hệ quả

- Một lệnh `pnpm build|lint|typecheck|test` chạy toàn repo, có cache.
- Cần giữ hướng phụ thuộc rõ ràng (`packages/` không phụ thuộc `apps/`).
- Người đóng góp phải dùng pnpm; phiên bản pnpm/Node được ghim ở M0.
