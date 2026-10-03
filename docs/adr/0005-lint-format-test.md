# ADR 0005 — Công cụ lint, format, test và chính sách cài gói

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh

Monorepo (ADR 0001) cần linter, formatter và test runner dùng chung cho TypeScript và file `.astro` (ADR 0002). Yêu cầu: ít dependency, cấu hình ít, chạy được qua `pnpm lint|test|format` ở gốc. Vì site nói về bảo mật, việc cài gói cũng phải chặt: không chạy install script tùy tiện, không cài phiên bản vừa được đẩy lên.

## Các phương án

Linter và formatter:

1. **ESLint (flat config) + typescript-eslint + eslint-plugin-astro, Prettier + prettier-plugin-astro**: hệ sinh thái chuẩn, có hỗ trợ `.astro` chính thức.
2. Biome: một công cụ cho cả lint và format, nhanh, nhưng hỗ trợ `.astro` chưa đầy đủ (chỉ phần frontmatter).
3. Chỉ dùng ESLint, kể cả cho định dạng (rule stylistic): cấu hình nhiều, không định dạng được Markdown/JSON.

Test runner:

1. **Vitest**: chạy TypeScript trực tiếp, dùng chung Vite với Astro, không cần cấu hình.
2. `node:test`: không cần dependency, nhưng phải thêm bước biên dịch TS hoặc loader và không dùng chung pipeline với Astro.
3. Jest: cần thêm transform cho TS/ESM, nặng hơn.

## Quyết định

- **ESLint 10 flat config**: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-astro` recommended, một file `eslint.config.js` ở gốc.
- **Prettier** + `prettier-plugin-astro`, chạy cho toàn repo (kể cả `docs/`). Bỏ qua `.devcontainer/` để không đụng cấu hình container. Không dùng `eslint-config-prettier` vì các bộ rule đã chọn không có rule định dạng.
- **Vitest**, chạy `vitest run` ở gốc; test đặt cạnh mã nguồn (`*.test.ts`).
- Kiểm tra kiểu: `tsc` cho các package, `astro check` (`@astrojs/check`) cho `apps/web`.
- **TypeScript 6.0**, chưa dùng 7.0: `typescript-eslint` và `@astrojs/check` chưa hỗ trợ TS 7.
- Phiên bản dependency ghim chính xác trong `catalog` của `pnpm-workspace.yaml`; các package dùng `catalog:`.

Chính sách cài gói (pnpm 12, trong `pnpm-workspace.yaml`):

- `minimumReleaseAge: 1440`: chỉ cài phiên bản đã phát hành ít nhất 1 ngày. Phải khai báo tường minh vì giá trị mặc định 1440 có sẵn của pnpm chạy ở chế độ không strict. Khi khai báo, `minimumReleaseAgeStrict` được bật và gói quá mới bị chặn (đã thử: `turbo@2.11.7` mới 15 giờ bị từ chối, `^2.11.0` tự chọn `2.11.6`).
- `allowBuilds`: giữ mặc định không chạy install script của dependency. Hiện **không gói nào được phép**. `esbuild: false` được ghi tường minh: postinstall của nó chỉ kiểm tra hoặc tải lại binary, mà binary đã có qua optionalDependencies theo nền tảng.
- `engineStrict: true` với `engines.node: ">=24 <25"`; `packageManager` ghim pnpm kèm hash sha512.
- Commit `pnpm-lock.yaml`.
- Telemetry của Astro và Turbo tắt bằng biến môi trường đặt trực tiếp trong script (`ASTRO_TELEMETRY_DISABLED=1`, `TURBO_TELEMETRY_DISABLED=1`).

## Hệ quả

- Có 11 devDependency trực tiếp. Khi nâng cấp, sửa một chỗ duy nhất là `catalog`.
- Nâng cấp lên bản vừa phát hành phải chờ đủ 1 ngày, hoặc thêm `minimumReleaseAgeExclude` có ghi lý do.
- Gói mới có install script sẽ bị chặn cho tới khi được xem xét và thêm vào `allowBuilds` kèm lý do.
- Khi `typescript-eslint` và `@astrojs/check` hỗ trợ TS 7, cân nhắc nâng cấp.
- Chỉ dùng cho bản vá bảo mật khẩn cấp, ghi rõ lý do và gỡ khỏi danh sách loại trừ sau khi bản đó đủ 1 ngày tuổi.
