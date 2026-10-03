# ADR 0004 — Song ngữ, tiếng Việt ở gốc

- Trạng thái: Chấp nhận
- Ngày: 2026-10-03

## Bối cảnh
Người đọc chính dùng tiếng Việt, nhưng muốn tiếp cận cả người đọc quốc tế. Thời gian có hạn nên bản dịch tiếng Anh có thể ra sau bản gốc. URL phải ổn định lâu dài.

## Các phương án
1. **vi ở `/`, en ở `/en`, slug chung.**
2. `/vi` và `/en` ngang hàng, `/` chuyển hướng theo ngôn ngữ trình duyệt.
3. Slug dịch riêng cho từng ngôn ngữ.
4. Chỉ một ngôn ngữ.

## Quyết định
- Tiếng Việt ở gốc `/`, tiếng Anh ở `/en`.
- Hai bản dùng **chung slug**; slug đã xuất bản là **vĩnh viễn**.
- Dịch toàn bộ (nội dung và giao diện), nhưng bản Anh được phép ra sau; frontmatter có `translation: pending | done`.
- Mọi chuỗi giao diện có đủ `vi` và `en`.

## Hệ quả
- URL tiếng Việt ngắn gọn, không cần chuyển hướng theo trình duyệt.
- Dễ ghép cặp bản dịch (cùng slug) cho `hreflang` và nút đổi ngôn ngữ.
- Slug tiếng Anh không dịch, nên slug nên đặt bằng thuật ngữ kỹ thuật ASCII.
- Bản `pending` cần thông báo và liên kết sang bản tiếng Việt; build cần kiểm tra thiếu chuỗi i18n.
