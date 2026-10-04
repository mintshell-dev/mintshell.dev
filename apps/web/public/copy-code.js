// Nút sao chép cho khối code. Script NGOÀI (không nội tuyến) để hợp CSP 'self' (ADR 0007).
// Progressive enhancement: không có JS hoặc không có Clipboard API thì khối code vẫn đọc và
// bôi đen thủ công được; chỉ khi đủ điều kiện mới gắn nút.
(function () {
  'use strict';

  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    return;
  }

  function enhance(container) {
    var labelCopy = container.getAttribute('data-label-copy') || 'Copy';
    var labelCopied = container.getAttribute('data-label-copied') || 'Copied';
    var blocks = container.querySelectorAll('pre');

    blocks.forEach(function (pre) {
      var code = pre.querySelector('code');
      if (!code) return;

      var wrap = document.createElement('div');
      wrap.className = 'code-block';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-button';
      button.textContent = labelCopy;
      wrap.appendChild(button);

      var timer;
      button.addEventListener('click', function () {
        navigator.clipboard.writeText(code.innerText).then(function () {
          button.textContent = labelCopied;
          window.clearTimeout(timer);
          timer = window.setTimeout(function () {
            button.textContent = labelCopy;
          }, 2000);
        });
      });
    });
  }

  function init() {
    document.querySelectorAll('[data-copy-code]').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
