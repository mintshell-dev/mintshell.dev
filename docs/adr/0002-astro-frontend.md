# ADR 0002 — Frontend Astro + React islands, nội dung MDX

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh
Site chủ yếu là nội dung tĩnh (write-up, cheatsheet, portfolio), cần nhanh, ít JavaScript, hỗ trợ song ngữ, tìm kiếm tĩnh và RSS. Chỉ vài chỗ cần tương tác (chuyển theme, tìm kiếm). CSP phải chặt và không tải tài nguyên từ bên thứ ba.

## Các phương án
1. **Astro + React islands + MDX** — mặc định không gửi JS, chỉ hydrate phần cần; content collections có schema; MDX cho phép nhúng component.
2. Next.js — mạnh nhưng hướng ứng dụng động, nhiều JS hơn mức cần.
3. Hugo — build rất nhanh nhưng template Go, khó dùng chung component TypeScript/React.
4. Eleventy — nhẹ, linh hoạt nhưng hệ sinh thái component và kiểu yếu hơn.

## Quyết định
- Dùng **Astro** (SSG) với **React islands** cho phần tương tác, nội dung **MDX** trong Git, **Pagefind** cho tìm kiếm, RSS cho mỗi ngôn ngữ.
- Font **tự host qua `@fontsource`** (Be Vietnam Pro, JetBrains Mono), chỉ subset `latin` + `vietnamese`; **không dùng Google Fonts CDN**.

## Hệ quả
- Trang nhẹ, gần như không JS ngoài các island.
- Frontmatter được kiểm tra bằng schema (đặt trong `packages/shared`).
- Font tự host: không lộ IP người đọc cho Google, CSP giữ được `font-src 'self'`; đổi lại phải tự cập nhật phiên bản font và chịu dung lượng font trong bundle (giảm nhờ chỉ lấy 2 subset).
- Gói `@fontsource` sẽ được thêm ở M1 sau khi xác nhận.
