# ADR 0011 — Override http-cache-semantics lên bản vá

Ngày: 2026-10-05 · Trạng thái: Đã chấp nhận · Mốc: bảo trì sau M3b

## Bối cảnh

pnpm audit báo lỗ hổng high GHSA-ch52-4w7c-c8xp ở http-cache-semantics 4.2.0,
dependency gián tiếp của astro 7.3.5 (và @astrojs/mdx). Bản vá 4.3.0 phát hành
2026-10-04 02:56 UTC. Gói chỉ dùng trong công cụ build, không chạy trên trang
tĩnh, nên rủi ro thực tế thấp.

## Các phương án

1. Nâng Astro: thay đổi lớn, không tương xứng để vá một dependency con.
2. pnpm overrides: ép riêng http-cache-semantics lên ^4.3.0. Hẹp, ít rủi ro.
3. Dùng minimumReleaseAgeExclude để cài ngay bản 4.3.0 chưa đủ tuổi.

## Quyết định

Chọn phương án 2, KHÔNG dùng phương án 3. Lỗ hổng không khẩn cấp nên không đủ
điều kiện dùng ngoại lệ theo ADR 0005. Việc vá được hoãn có chủ đích cho tới khi
bản 4.3.0 đủ 1 ngày tuổi (sau 2026-10-05 02:56 UTC), rồi cài bình thường dưới
chính sách minimumReleaseAge.

Override đặt trong pnpm-workspace.yaml (pnpm 12 không còn đọc trường "pnpm"
trong package.json): `http-cache-semantics@<4.3.0: ^4.3.0`. Có cận trên ^ để
không nhảy sang major mới.

## Hệ quả

- pnpm audit sạch; lint, typecheck, test, build, test:dist, format:check đều qua.
- Khi nâng Astro lên bản tự dùng >=4.3.0, gỡ override này và chạy lại audit.
- Bài học: chính sách chờ 1 ngày đã chặn đúng một bản phát hành mới; với lỗ hổng
  rủi ro thấp, chờ là lựa chọn đúng.
