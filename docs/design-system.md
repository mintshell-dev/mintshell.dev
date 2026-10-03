# Design system — "Terminal tinh tế"

Gọn gàng, nhiều khoảng trắng, gợi cảm giác terminal nhưng dễ đọc. **Mặc định tối**, có chế độ sáng.

## Nguyên tắc

- Code chỉ dùng token (CSS variables); không ghi cứng màu, font, spacing.
- Token viết theo chuẩn **W3C Design Tokens** (JSON) trong `packages/tokens/tokens/`, sinh bằng **script TypeScript tự viết** (`pnpm --filter @mintshell/tokens build`, xem [ADR 0006](adr/0006-design-token-pipeline.md)):
  - `dist/tokens.css` (import qua `@mintshell/tokens/tokens.css`): CSS variables, `:root` là theme tối, `[data-theme="light"]` là theme sáng.
  - `dist/tokens.ts` (import qua `@mintshell/tokens`): hằng số TypeScript cho nơi không dùng CSS (ví dụ video Remotion).
- Giá trị token phải nằm trong allowlist theo `$type` (màu `#RRGGBB`, `px|rem|em`, `ms`, weight 100–900, tên font `[A-Za-z0-9 -]`), nếu không build báo lỗi (ADR 0006).
- Tên biến: path nối bằng `-`, camelCase đổi sang kebab-case (`color.onAccent` → `--color-on-accent`).
- Chuyển theme bằng thuộc tính `data-theme="dark|light"` trên `<html>`; không có thuộc tính thì dùng theme tối.
- Độ tương phản đạt WCAG AA, kiểm tra tự động bằng test trong `packages/tokens`.

## Màu

| Token                | CSS variable            | Tối       | Sáng      |
| -------------------- | ----------------------- | --------- | --------- |
| `color.bg`           | `--color-bg`            | `#0B0F14` | `#FAFAF7` |
| `color.surface`      | `--color-surface`       | `#121821` | `#FFFFFF` |
| `color.border`       | `--color-border`        | `#1F2A37` | `#E2E8F0` |
| `color.borderStrong` | `--color-border-strong` | `#5B6B7C` | `#7C8799` |
| `color.text`         | `--color-text`          | `#E6EDF3` | `#0F172A` |
| `color.muted`        | `--color-muted`         | `#8B98A5` | `#475569` |
| `color.accent`       | `--color-accent`        | `#3DDC97` | `#047857` |
| `color.onAccent`     | `--color-on-accent`     | `#0B0F14` | `#FFFFFF` |
| `color.highlight`    | `--color-highlight`     | `#F5B841` | `#B45309` |

- `color.onAccent`: chữ trên nền `color.accent` (nút chính).
- `color.border` chỉ đạt khoảng 1.2–1.3:1 so với `bg`/`surface`: chỉ dùng cho đường phân cách trang trí.
- `color.borderStrong`: ranh giới thành phần tương tác (nút, ô nhập), đạt ≥ 3:1 trên `bg` và `surface` ở cả hai theme (WCAG 1.4.11; tối 3.51/3.26:1, sáng 3.47/3.63:1), có test.

### Severity (tách theo theme)

Theme tối giữ màu tươi; theme sáng dùng tông đậm để chữ đạt ≥ 4.5:1 trên nền sáng.

| Token               | CSS variable          | Tối       | Sáng      |
| ------------------- | --------------------- | --------- | --------- |
| `severity.critical` | `--severity-critical` | `#E5484D` | `#B91C1C` |
| `severity.high`     | `--severity-high`     | `#F76B15` | `#C2410C` |
| `severity.medium`   | `--severity-medium`   | `#F5B841` | `#A16207` |
| `severity.low`      | `--severity-low`      | `#3B82F6` | `#1D4ED8` |
| `severity.info`     | `--severity-info`     | `#8B98A5` | `#475569` |

`severity.critical` theme tối trên `surface` chỉ đạt 4.55:1, sát ngưỡng: không làm tối thêm màu này.

### Độ tương phản được test

Ở cả hai theme, trên cả `bg` và `surface`, mức tối thiểu 4.5:1:

- `color.text`, `color.muted`, `color.accent`, `color.highlight`;
- 5 mức `severity.*`;
- thêm `color.onAccent` trên `color.accent`;
- `color.borderStrong` trên `bg` và `surface`: tối thiểu 3:1 (không phải chữ).

## Font

| Token       | Font           | Dùng cho                 |
| ----------- | -------------- | ------------------------ |
| `font.sans` | Be Vietnam Pro | chữ thường               |
| `font.mono` | JetBrains Mono | code, nhãn kiểu terminal |

- **Tự host qua `@fontsource`**, nạp trong `apps/web/src/styles/global.css`. Weight: Be Vietnam Pro 400/500/600, JetBrains Mono 400/500.
- Import file theo weight (`400.css`, …) vì có `unicode-range`, trình duyệt chỉ tải subset cần dùng (thực tế là `latin` + `vietnamese`). File theo subset (`latin-400.css`, …) **thiếu `unicode-range`** nên khiến trình duyệt tải mọi subset đã import. Đổi lại, `dist` có thêm các file subset `latin-ext`/`cyrillic`/`greek` nhưng chúng không được tải nếu trang không dùng.
- `vite.build.assetsInlineLimit: 0`: không nhúng font nhỏ thành `data:` URI, để CSP giữ được `font-src 'self'`. `build.inlineStylesheets: 'never'`: CSS luôn là file, không cần `style-src 'unsafe-inline'`. Xem [ADR 0006](adr/0006-design-token-pipeline.md).
- **Không dùng Google Fonts CDN.** Lý do: quyền riêng tư người đọc (không gửi IP sang bên thứ ba) và CSP chặt (`font-src 'self'`).
- Xem [ADR 0002](adr/0002-astro-frontend.md).

### Cỡ chữ

| Token            | Giá trị    | Dùng cho               |
| ---------------- | ---------- | ---------------------- |
| `font.size.sm`   | `0.875rem` | menu, footer, nhãn nút |
| `font.size.base` | `1rem`     | chữ thường             |
| `font.size.lg`   | `1.25rem`  | handle `mintshell_`    |
| `font.size.xl`   | `1.75rem`  | tiêu đề trang          |

## Spacing, kích thước và bo góc

- Spacing: bội số 4px, `space.N` = N × 4px. Có sẵn các mức N = 1, 2, 3, 4, 5, 6, 8, 10, 12, 16.
- Kích thước: `size.control` = 44px (nút vuông, đủ vùng chạm), `size.content` = 64rem (độ rộng tối đa của nội dung).
- Viền: `border.width.thin` = 1px (viền, gạch chân link), `border.width.focus` = 2px (vòng focus).
- Bo góc: `radius.sm` = 4px, `radius.md` = 8px.

## Tương tác và truy cập

- Focus bàn phím: `:focus-visible` vẽ outline `border.width.focus` màu `color.accent`, cách phần tử `space.1`.
- Nút điều khiển (`.control`): vuông `size.control`, viền `color.borderStrong`; hover đổi viền và chữ sang `color.accent`.
- Link menu: gạch chân chạy từ trái sang khi hover/focus, thời lượng `motion.duration.base`. Link nằm giữa chữ cùng màu (footer) luôn gạch chân.
- Link "Bỏ qua tới nội dung" là phần tử focus đầu tiên của mọi trang.

## Chuyển động

| Token                  | Giá trị | Dùng cho               |
| ---------------------- | ------- | ---------------------- |
| `motion.duration.fast` | 150ms   | hover, focus           |
| `motion.duration.base` | 250ms   | mở/đóng thành phần nhỏ |
| `motion.duration.slow` | 400ms   | chuyển cảnh lớn        |

Tôn trọng `prefers-reduced-motion: reduce`: `tokens.css` đưa mọi `--motion-duration-*` về `0ms`. Vì vậy chuyển động phải dùng các biến này, không ghi cứng thời lượng.
