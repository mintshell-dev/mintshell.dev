# ADR 0006 — Sinh design token bằng script TypeScript tự viết

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh

Design system (xem [design-system.md](../design-system.md)) cần một nguồn token duy nhất cho màu, font, spacing, bo góc và chuyển động. Có hai theme (tối mặc định, sáng) và phải đạt WCAG AA. Từ nguồn này cần sinh ra:

- CSS variables cho website Astro;
- hằng số TypeScript để sau này video Remotion dùng chung token với website.

Bộ token nhỏ, khoảng 40 giá trị. ADR 0005 đặt ra yêu cầu ít dependency và kiểm soát chặt việc cài gói.

## Các phương án

1. **Style Dictionary**: công cụ chuẩn, hỗ trợ W3C Design Tokens, nhiều định dạng đầu ra. Nhưng kéo theo khoảng 13 dependency, cấu hình theme phải dựa vào filter/nhiều lần build, và phần lớn tính năng (Android, iOS, transform group) không dùng tới.
2. Theo hoặc các công cụ tương tự: ít phổ biến hơn, vẫn là dependency ngoài cho một việc nhỏ.
3. **Script TypeScript tự viết**: khoảng 100 dòng, đọc JSON theo chuẩn W3C rồi ghi CSS và TS. Chạy trực tiếp bằng Node 24 (type stripping), không cần thêm dependency.
4. Viết tay CSS variables, không có nguồn JSON: đơn giản nhất nhưng không dùng chung được với Remotion và khó test tương phản.

## Quyết định

- **Phương án 3.** Token đặt trong `packages/tokens/tokens/`:
  - `base.json`: space, radius, font, font weight, motion;
  - `theme.dark.json` và `theme.light.json`: `color.*` và `severity.*`, hai file phải có cùng tập khóa.
- Định dạng W3C Design Tokens: `$value`, `$type`, `$type` kế thừa từ nhóm cha.
- `src/generate.ts` chỉ gồm hàm thuần, được test trực tiếp. `src/build.ts` ghi ra:
  - `dist/tokens.css` có ba khối:
    - `:root` (base + theme tối, `color-scheme: dark`);
    - `[data-theme="light"]` (theme sáng, `color-scheme: light`);
    - `@media (prefers-reduced-motion: reduce)` đưa mọi `--motion-duration-*` về `0ms`.
  - `dist/tokens.ts`: `export const tokens = { …, theme: { dark, light } } as const`.
- **Severity tách theo theme**: theme sáng dùng tông đậm, để chữ đạt ≥ 4.5:1 trên nền sáng.
- Thêm `color.onAccent` cho chữ trên nền accent (nút chính).
- Vitest kiểm tra:
  - công thức tương phản WCAG 2.x;
  - mức ≥ 4.5:1 cho chữ, severity và `onAccent`/`accent` ở cả hai theme;
  - CSS sinh ra có đủ biến.
- `dist/` không commit. Turbo chạy `build` của `@mintshell/tokens` trước `build` và `dev` của `apps/web` (`dependsOn: ["^build"]`).
- **Kiểm tra giá trị theo allowlist** (theo review bảo mật, mục L1). Giá trị token được ghi nguyên văn vào CSS, nên một MR sửa JSON có thể chèn `url()` hoặc `@import` trỏ ra ngoài. Vì vậy `formatValue` chỉ chấp nhận:
  - `color`: `#RRGGBB`;
  - `dimension`: số + `px|rem|em`;
  - `duration`: số nguyên + `ms`;
  - `fontWeight`: số nguyên từ 100 đến 900;
  - `fontFamily`: mảng không rỗng, mỗi tên chỉ gồm `[A-Za-z0-9 -]`;
  - tên khóa: chỉ `[A-Za-z0-9]`.

  `$type` khác hoặc giá trị không khớp thì build báo lỗi và dừng với exit code khác 0. Có test cho các trường hợp chèn `url()`, `@import`, `;`, `}` và dấu nháy.

- Font: import file `@fontsource/*/<weight>.css` (có `unicode-range`), không dùng file theo subset (thiếu `unicode-range`).
- Chuẩn bị cho CSP ở M5, trong `apps/web/astro.config.ts`:
  - `vite.build.assetsInlineLimit: 0`: Vite không nhúng tài nguyên nhỏ thành `data:` URI. Trước khi đặt, 6 file font dưới 4KB đã bị nhúng và sẽ bị `font-src 'self'` chặn.
  - `build.inlineStylesheets: 'never'` (theo review bảo mật, mục L2): CSS luôn là file `<link>`, không thành `<style>`, nên không cần `style-src 'unsafe-inline'`.

## Hệ quả

- Không thêm dependency để sinh token. Dependency mới gồm `@fontsource/be-vietnam-pro` và `@fontsource/jetbrains-mono` (không có install script, giấy phép OFL-1.1), cùng devDependency `@types/node`.
- Phải tự bảo trì script. Nếu sau này cần nhiều định dạng đầu ra, alias/reference (`{color.bg}`) hoặc nhiều nền tảng, cân nhắc lại Style Dictionary.
- Script chưa hỗ trợ alias/reference. Thêm `$type` mới (ví dụ `shadow`) thì phải mở rộng allowlist kèm test.
- Thêm devDependency `@types/node` (24.x, khớp `engines.node`) cho `packages/tokens`, để `src/build.ts` cũng qua `tsc`.
- `dist` của web có thêm các file subset font không dùng (latin-ext, cyrillic, greek), nhưng trình duyệt không tải chúng nếu trang không cần.
