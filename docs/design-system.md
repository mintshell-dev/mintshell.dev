# Design system — "Terminal tinh tế"

Gọn gàng, nhiều khoảng trắng, gợi cảm giác terminal nhưng dễ đọc. **Mặc định tối**, có chế độ sáng.

## Nguyên tắc

- Code chỉ dùng token (CSS variables); không ghi cứng màu, font, spacing.
- Token viết theo chuẩn **W3C Design Tokens** (JSON) trong `packages/tokens`, sinh CSS variables bằng **Style Dictionary**.
- Chuyển theme bằng thuộc tính `data-theme="dark|light"` trên `<html>`.
- Độ tương phản đạt WCAG AA (kiểm tra ở M1).

## Màu

| Token             | CSS variable        | Tối       | Sáng      |
| ----------------- | ------------------- | --------- | --------- |
| `color.bg`        | `--color-bg`        | `#0B0F14` | `#FAFAF7` |
| `color.surface`   | `--color-surface`   | `#121821` | `#FFFFFF` |
| `color.border`    | `--color-border`    | `#1F2A37` | `#E2E8F0` |
| `color.text`      | `--color-text`      | `#E6EDF3` | `#0F172A` |
| `color.muted`     | `--color-muted`     | `#8B98A5` | `#475569` |
| `color.accent`    | `--color-accent`    | `#3DDC97` | `#047857` |
| `color.highlight` | `--color-highlight` | `#F5B841` | `#B45309` |

### Severity (dùng chung cho cả hai theme)

| Token               | CSS variable          | Giá trị   |
| ------------------- | --------------------- | --------- |
| `severity.critical` | `--severity-critical` | `#E5484D` |
| `severity.high`     | `--severity-high`     | `#F76B15` |
| `severity.medium`   | `--severity-medium`   | `#F5B841` |
| `severity.low`      | `--severity-low`      | `#3B82F6` |
| `severity.info`     | `--severity-info`     | `#8B98A5` |

## Font

| Token       | Font           | Dùng cho                 |
| ----------- | -------------- | ------------------------ |
| `font.sans` | Be Vietnam Pro | chữ thường               |
| `font.mono` | JetBrains Mono | code, nhãn kiểu terminal |

- **Tự host qua `@fontsource`**, chỉ subset `latin` + `vietnamese`.
- **Không dùng Google Fonts CDN.** Lý do: quyền riêng tư người đọc (không gửi IP sang bên thứ ba) và CSP chặt (`font-src 'self'`).
- Gói `@fontsource` thêm ở M1 (hỏi trước khi cài). Xem [ADR 0002](adr/0002-astro-frontend.md).

## Spacing và bo góc

- Spacing: bội số 4px — `space.1` = 4px, `space.2` = 8px, `space.3` = 12px, `space.4` = 16px, …
- Bo góc: `radius.sm` = 4px, `radius.md` = 8px.

## Chuyển động

| Token                  | Giá trị | Dùng cho               |
| ---------------------- | ------- | ---------------------- |
| `motion.duration.fast` | 150ms   | hover, focus           |
| `motion.duration.base` | 250ms   | mở/đóng thành phần nhỏ |
| `motion.duration.slow` | 400ms   | chuyển cảnh lớn        |

Tôn trọng `prefers-reduced-motion: reduce`: tắt hoặc rút gần về 0 mọi chuyển động không thiết yếu.
