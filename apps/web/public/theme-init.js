/*
 * Đặt data-theme trước khi trang hiển thị để không nháy sai theme (ADR 0007).
 * Nạp bằng <script src> chặn render trong <head>, không nhúng nội tuyến, để CSP chỉ cần 'self'.
 * Thứ tự: lựa chọn đã lưu → prefers-color-scheme của hệ điều hành → tối.
 * Gắn data-js trước tiên: CSS chỉ hiện nút chuyển theme khi có JavaScript.
 */
(function () {
  var root = document.documentElement;
  root.setAttribute('data-js', '');

  var saved = null;
  try {
    saved = localStorage.getItem('theme');
  } catch {
    // localStorage bị chặn (chế độ riêng tư, tắt cookie…): bỏ qua lựa chọn đã lưu.
  }

  var theme = 'dark';
  if (saved === 'light' || saved === 'dark') {
    theme = saved;
  } else if (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: light)').matches
  ) {
    theme = 'light';
  }
  root.setAttribute('data-theme', theme);
})();
