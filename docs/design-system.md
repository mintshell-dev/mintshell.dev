# Design system — "Terminal tinh tế"

Gọn gàng, nhiều khoảng trắng, gợi cảm giác terminal nhưng dễ đọc. **Mặc định tối**, có chế độ sáng.

## Bộ nhận diện

- **Biểu tượng**: vỏ ốc màu bạc hà, bên trong có dấu nhắc lệnh `>_`. Nét vẽ màu `color.accent` của theme tối (`#3DDC97`) trên nền vuông bo góc màu `color.bg` của theme tối (`#0B0F14`).
- **Avatar** (mạng xã hội, nền tảng CTF/bug bounty): cùng biểu tượng, thêm đôi mắt màu `color.text` của theme tối (`#E6EDF3`), con ngươi màu `color.bg` tối.
- **Favicon** lược bỏ mắt để biểu tượng rõ ở cỡ nhỏ (16–32px); chỉ dùng `color.bg` và `color.accent` tối.
- **Nguồn gốc**: thư mục `brand/` ở gốc repo (`avatar.svg`, `favicon.svg`, bản vector gốc). File trong `apps/web/public/` là **bản xuất** để phục vụ web, không sửa tay: đổi biểu tượng thì sửa trong `brand/` rồi xuất lại.
- **Metadata nguồn gốc**:
  - Bản gốc trong `brand/` **giữ** metadata C2PA. Đây là chủ đích, để minh bạch nguồn gốc file. Thư mục này không được phục vụ trên web nên vài KB metadata không ảnh hưởng.
  - Bản xuất trong `apps/web/public/` **bỏ** metadata: C2PA, chunk văn bản/EXIF của PNG (`caBX`, `tEXt`, `iTXt`, `zTXt`, `eXIf`) và `<metadata>` của SVG. Chỉ giữ dữ liệu ảnh để file nhẹ; `test:dist` kiểm tra.
- **Favicon** trong `apps/web/public/`, khai báo ở `BaseLayout.astro`:

  | File                   | Kích thước | Dùng cho                               |
  | ---------------------- | ---------- | -------------------------------------- |
  | `favicon.svg`          | vector     | trình duyệt hỗ trợ favicon SVG         |
  | `favicon-32.png`       | 32×32      | trình duyệt không hỗ trợ SVG           |
  | `apple-touch-icon.png` | 180×180    | iOS/iPadOS khi thêm vào màn hình chính |

- **Trong giao diện**, component `apps/web/src/components/BrandMark.astro`:
  - SVG nội tuyến, vẽ lại từ phần hình vẽ trong `brand/`. Không có nền, không có metadata.
  - Màu lấy từ token qua class trong stylesheet, nên tự đổi theo theme. Không dùng `style=`, không ghi cứng mã màu: nét vỏ và `>_` dùng `color.accent`, mắt dùng `color.text`, con ngươi dùng `color.bg`.
  - Hai biến thể:

    | `variant` | Mắt   | Cỡ                    | Dùng ở                                                                                |
    | --------- | ----- | --------------------- | ------------------------------------------------------------------------------------- |
    | `mark`    | không | `size.mark` (28px)    | header, trước chữ `mintshell_`                                                        |
    | `avatar`  | có    | `size.avatar` (120px) | phần liên hệ của portfolio; di động đặt trên tiêu đề, từ `48rem` đặt bên trái tiêu đề |

  - Luôn `aria-hidden="true"`, vì chữ bên cạnh đã là tên.
  - Tương phản ≥ 3:1 (thành phần đồ họa, WCAG 1.4.11) ở cả hai theme, có test trong `packages/tokens`: `accent` trên `bg`, `text` trên `bg`, `bg` trên `text`.
  - Ở theme sáng, mắt có màu tối và con ngươi màu sáng (đảo so với theme tối), vì màu đi theo token.
  - `test:dist` kiểm tra: header mọi trang có `mark`; portfolio có `avatar`; mọi SVG nội tuyến không có `<script>`, `on*=`, `style=`, metadata, tham chiếu ra ngoài, hay `fill`/`stroke` ghi cứng (chỉ cho `none`/`currentColor`).
- `<meta name="theme-color">` lấy `color.bg` của theme tối từ `@mintshell/tokens` (theme mặc định), không ghi cứng.
- Màu trong file ảnh là ngoại lệ có chủ đích: ảnh không đọc được CSS variable, nên giá trị phải trùng token theme tối ở trên; đổi token thì xuất lại ảnh.
- `favicon.svg` chỉ được chứa hình vẽ: không `<script>`, không thuộc tính `on*=`, không tham chiếu ra ngoài (`test:dist` kiểm tra), vì mở trực tiếp `/favicon.svg` thì trình duyệt chạy script trong SVG.

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

| Token            | Giá trị    | Dùng cho                                       |
| ---------------- | ---------- | ---------------------------------------------- |
| `font.size.sm`   | `0.875rem` | menu, footer, nhãn nút                         |
| `font.size.base` | `1rem`     | chữ thường                                     |
| `font.size.lg`   | `1.25rem`  | handle `mintshell_`                            |
| `font.size.xl`   | `1.75rem`  | tiêu đề trang                                  |
| `font.size.2xl`  | `2rem`     | số liệu, đoạn "cách làm việc", email (di động) |
| `font.size.3xl`  | `2.75rem`  | tiêu đề hero/liên hệ (di động), email          |
| `font.size.4xl`  | `3.5rem`   | tiêu đề hero                                   |
| `font.size.5xl`  | `4.5rem`   | tiêu đề liên hệ "Nói chuyện nhé."              |

Chiều cao dòng (`$type: number`): `font.lineHeight.tight` 1.1 (tiêu đề lớn), `snug` 1.35 (đoạn cỡ lớn), `normal` 1.6 (chữ thường).

## Spacing, kích thước và bo góc

- Spacing: bội số 4px, `space.N` = N × 4px. Có sẵn các mức N = 1, 2, 3, 4, 5, 6, 8, 10, 12, 16.
- Kích thước: `size.control` = 44px (nút vuông, đủ vùng chạm), `size.content` = 64rem (độ rộng tối đa của nội dung), `size.mark` = 28px và `size.avatar` = 120px (BrandMark), `size.figure` = 28rem (độ rộng tối đa sơ đồ chuỗi tấn công).
- Viền: `border.width.thin` = 1px (viền, gạch chân link), `border.width.focus` = 2px (vòng focus), `border.width.accent` = 3px (viền trái callout).
- Bo góc: `radius.sm` = 4px, `radius.md` = 8px.
- **Breakpoint** `48rem`: ngoại lệ có chủ đích, ghi thẳng trong `@media (min-width: 48rem)` vì CSS variable không dùng được trong media query. Dưới mức này là bố cục một cột (di động).

## Tương tác và truy cập

- Focus bàn phím: `:focus-visible` vẽ outline `border.width.focus` màu `color.accent`, cách phần tử `space.1`.
- Nút điều khiển (`.control`): vuông `size.control`, viền `color.borderStrong`; hover đổi viền và chữ sang `color.accent`.
- Link menu: gạch chân chạy từ trái sang khi hover/focus, thời lượng `motion.duration.base`. Link nằm giữa chữ cùng màu (footer) luôn gạch chân.
- Link "Bỏ qua tới nội dung" là phần tử focus đầu tiên của mọi trang.

## Thành phần nội dung MDX ([ADR 0012](adr/0012-mdx-components-og-image.md))

Dùng trong `vi.mdx`/`en.mdx` không cần import.

- `<Callout type="…" title?>`: viền trái `border.width.accent`, nền `color.surface`, bo `radius.sm`; hàng nhãn mono (icon SVG `currentColor` + nhãn từ từ điển `callout.*`, `title` ghi đè), rồi nội dung.

  | `type`     | Màu viền/nhãn       | Nhãn vi / en            |
  | ---------- | ------------------- | ----------------------- |
  | `tldr`     | `color.accent`      | TL;DR / TL;DR           |
  | `critical` | `severity.critical` | Nghiêm trọng / Critical |
  | `insight`  | `color.highlight`   | Điểm mấu chốt / Insight |
  | `note`     | `severity.low`      | Ghi chú / Note          |
  | `fix`      | `color.muted`       | Khắc phục / Fix         |

  Mọi màu nhãn và `color.text` đạt ≥ 4.5:1 trên `color.surface` ở cả hai theme (có test).

- `<AttackChain label="…" steps={[{ label, description, critical? }]} />`: SVG nội tuyến các ô xếp dọc nối bằng mũi tên `color.borderStrong`. Viền và số thứ tự của bước thường dùng `color.accent`, bước critical (đánh dấu, mặc định là bước cuối) dùng `severity.critical`. Chữ mono, tự ngắt dòng lúc build; `role="img"` + `aria-label` = `label`; chú thích "Chuỗi tấn công" / "Attack chain".

## Ảnh Open Graph

- 1200×630 PNG, sinh lúc build ([ADR 0012](adr/0012-mdx-components-og-image.md)): nền `color.bg`, khung `color.border`, handle `mintshell_`, dòng lệnh giả `$ cat writeups/<slug>/<locale>.mdx`, tiêu đề Be Vietnam Pro 600 (tối đa 3 dòng), nền tảng · độ khó (màu severity như trang write-up), chip loại lỗi (`color.surface`/`color.borderStrong`), con ốc `color.accent` mờ 12% ở góc phải dưới.
- Màu là token theme tối (ngoại lệ "màu trong file ảnh"); đổi token thì cache ảnh tự mất hiệu lực.
- Ảnh mặc định `/og/default.png` cho trang không có cover riêng.

## Chuyển động

| Token                  | Giá trị                         | Dùng cho                       |
| ---------------------- | ------------------------------- | ------------------------------ |
| `motion.duration.fast` | 150ms                           | hover, focus                   |
| `motion.duration.base` | 250ms                           | mở/đóng thành phần nhỏ         |
| `motion.duration.slow` | 400ms                           | chuyển cảnh lớn                |
| `motion.duration.type` | 1200ms                          | gõ một lệnh trong terminal giả |
| `motion.easing.out`    | `cubic-bezier(0.16, 1, 0.3, 1)` | trượt lên, nhích khi hover     |

Tôn trọng `prefers-reduced-motion: reduce`: `tokens.css` đưa mọi `--motion-duration-*` về `0ms`. Vì vậy chuyển động phải dùng các biến này, không ghi cứng thời lượng.

### Hiệu ứng chỉ bằng CSS ([ADR 0008](adr/0008-portfolio-data-css-motion.md))

- **Trạng thái gốc là trạng thái cuối.** Animation chỉ khai báo trong `@media (prefers-reduced-motion: no-preference)`, dùng `fill-mode: both`. Khi giảm chuyển động hoặc animation không chạy, nội dung vẫn hiện đủ (terminal hiện đủ chữ).
- `.rise` + `.rise-2..5`: trượt lên so le khi tải trang, trễ theo bội số `motion.duration.fast`.
- `.reveal`: hiện dần khi cuộn tới bằng `animation-timeline: view()`, bọc trong `@supports`; trình duyệt chưa hỗ trợ thì hiện bình thường.
- Terminal giả: gõ chữ bằng `steps(var(--type-chars))` trên `max-width` theo `ch`, `--type-chars` khớp giới hạn độ dài lệnh trong schema; độ trễ từng dòng đặt trong class `.cmd-N`/`.out-N` của stylesheet, không dùng `style=`.
- Hover chỉ dành cho phần tử bấm được: nút nhích lên `space.1`, mũi tên trượt; hàng dự án có link đổi nền `color.surface`, tên đổi `color.accent`, ↗ nhích lên chéo. Hàng không có link không có hover.
