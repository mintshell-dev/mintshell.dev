# Quy trình làm việc

Lệnh, quy ước và định nghĩa hoàn thành. Luật bảo mật và quy trình bắt buộc nằm trong [CLAUDE.md](../CLAUDE.md).

## Stack

TypeScript · pnpm + Turborepo · Astro + React islands · nội dung MDX trong Git · Pagefind · RSS · Cloudflare Worker static assets (wrangler) · GitLab CI. Giai đoạn 1 **không có backend**.

## Lệnh (có từ khi xong M0)

```sh
pnpm install            # cài dependency
pnpm dev                # chạy dev server
pnpm build              # build toàn bộ
pnpm lint               # lint
pnpm typecheck          # kiểm tra kiểu
pnpm test               # chạy unit test
pnpm test:dist          # build rồi kiểm tra bản build (apps/web/dist)
pnpm format:check       # kiểm tra định dạng (pnpm format để sửa)
pnpm --filter web <lệnh>  # chạy lệnh cho một gói
pnpm notion:pull        # THỦ CÔNG: kéo bài Notion "Ready" về _import/ để soát (xem dưới)
pnpm writeups:promote <slug>|--all   # THỦ CÔNG: chuyển cơ học _import/<slug>/vi.md → content/writeups/<slug>/vi.mdx (xem dưới)
pnpm build && pnpm --filter web exec wrangler dev   # thử header/routing như Cloudflare, ở local (xem dưới)
```

## CI/CD và deploy

[`.gitlab-ci.yml`](../.gitlab-ci.yml), lý do trong [ADR 0014](adr/0014-deploy-csp.md). MR chạy tới hết build +
security, không deploy; chỉ `main` (protected) deploy bằng `wrangler deploy`. Không deploy từ máy dev.

- Sửa CSP/header: `apps/web/public/_headers` **và** `apps/web/test-dist/headers.check.ts`. Thêm nguồn ngoài (Brevo,
  analytics) phải khai báo chính xác domain ở cả hai.
- Thử trước khi mở MR: `pnpm build`, rồi `WRANGLER_SEND_METRICS=false pnpm --filter web exec wrangler dev`
  và `curl -I http://127.0.0.1:8787/search` (miniflare áp `_headers`, `html_handling`, 404 như production).
- `security.txt` hết hạn theo `Expires`: `test:dist` báo lỗi khi còn dưới 30 ngày, gia hạn thêm ~1 năm.

## Quy ước

- Chỉ dùng design token (CSS variables từ `packages/tokens`); không ghi cứng màu, font, spacing.
- Mọi chuỗi giao diện phải có đủ `vi` và `en`.
- Slug đã xuất bản là vĩnh viễn; dùng chung cho cả hai ngôn ngữ.
- Commit theo Conventional Commits, ký SSH, email `hi@mintshell.dev`.
- `main` được bảo vệ; mọi thay đổi qua Merge Request.

## Định nghĩa hoàn thành

1. `lint`, `typecheck`, `test`, `build`, `test:dist`, `format:check` đều qua.
2. Cập nhật `docs/progress.md`.
3. Thêm ADR trong `docs/adr/` khi có quyết định kiến trúc.

## Đồng bộ Notion (`pnpm notion:pull`, thủ công)

Kéo bài Status = Ready từ database Notion "Mintshell" về `content/writeups/_import/<slug>/` để soát.
**Không xuất bản gì**, không tự sửa hay xóa khi thấy cảnh báo. Lý do thiết kế: [ADR 0013](adr/0013-notion-manual-pull.md).

**Chuẩn bị (một lần):**

1. Tạo integration Notion **chỉ bật quyền "Read content"**, rồi share database "Mintshell" với integration đó.
2. Chép `.env.example` thành `.env` (đã gitignore), điền `NOTION_TOKEN` và `NOTION_DATABASE_ID`. Token chỉ nằm
   trong `.env`; agent không bao giờ cần và không đọc file này.

**Quy ước trạng thái (cột Status trong Notion):**

- **Draft** — đang viết, chưa hoàn chỉnh. Script bỏ qua.
- **Ready** — đã xong, chờ kéo về xử lý. `notion:pull` chỉ kéo bài Ready.
- **Published** — đã kéo về, xử lý xong và chuyển sang `content/writeups/`. Script bỏ qua.

Sau khi xuất bản một bài (chuyển từ `_import/` sang `content/writeups/`, đặt `draft: false`), đổi Status của bài
đó trong Notion thành **Published**. Nhờ vậy mỗi bài chỉ được kéo đúng một lần; lần `notion:pull` sau không kéo
lại bài đã xuất bản.

Lưu ý: bài đang nằm trong `_import/<slug>/` không bị kéo lại (script bỏ qua thư mục đã tồn tại) trừ khi chạy với
`--force`. Nhưng sau khi đã xóa `_import/<slug>/` lúc xuất bản, nếu Notion vẫn để Ready thì bài sẽ bị kéo lại vào
`_import/` kèm cảnh báo "slug đã xuất bản". Đổi sang Published để tránh điều này.

**Tường lửa:** 2 host đã được mở sẵn trong `.devcontainer/init-firewall.sh`: `api.notion.com` và
`prod-files-secure.s3.us-west-2.amazonaws.com` (ảnh Notion), không cần sửa gì trước khi chạy. Lý do và đánh đổi:
ADR 0013, mục "Tường lửa: hai host Notion luôn mở". Agent không sửa file này. IP của S3 xoay vòng mà tường lửa chỉ phân giải DNS lúc khởi động, nên nếu báo cáo có ảnh
lỗi do kết nối thì khởi động lại tường lửa rồi chạy lại với `--force`.

**Nơi chạy:** việc thủ công, chạy **trong Dev Container** nhưng ở **một terminal riêng**, tách khỏi terminal đang chạy
Claude Code (không chạy ngoài container). Lý do: token và dữ liệu Notion chưa soát không đi vào ngữ cảnh của agent
(ADR 0013). Không đưa vào turbo hay CI.

**Chạy:**

```sh
pnpm notion:pull            # bỏ qua bài đã có trong _import/ (đang soát dở)
pnpm notion:pull --force    # ghi đè _import/<slug>/ đã có
pnpm notion:pull --external-images   # tải cả ảnh external (mặc định KHÔNG: lộ IP của bạn cho host đó)
```

Ảnh Notion lưu (S3) luôn được tải. Ảnh external mặc định chỉ được ghi chú `[[ẢNH EXTERNAL KHÔNG TẢI: <url>]]` và liệt
kê trong báo cáo.

**Hook chặn commit `_import/`:** tác giả tự thêm hook `no-notion-import` vào `.pre-commit-config.yaml` (nội dung trong
ADR 0013) để chặn cả `git add -f`. Agent không sửa file đó.

**Đọc báo cáo:** bảng mỗi bài (ảnh tải/lỗi/external không tải, flag, IP, prompt `user@host`, đường dẫn home, metadata ảnh, block chưa
hỗ trợ, frontmatter, khác),
rồi danh sách `content/writeups/_import/<slug>/vi.md:<dòng>` để nhảy tới, rồi danh sách ảnh để **tự mở xem** (script
không đọc được nội dung ảnh: chữ trong ảnh chụp màn hình phải tự kiểm). Dòng cuối là **TỔNG KẾT**. Cảnh báo cố ý báo
thừa (vd. mọi `user@host` trong code, mọi IPv4): tự loại những cái vô hại.

**Chuyển một bài sang `content/` (sau khi soát):**

- [ ] Che flag (`THM{REDACTED}`), IP, dấu nhắc terminal, email, đường dẫn home lộ tên máy/người dùng thật,
      chuỗi 32 hex (flag HackTheBox), mention người dùng Notion.
- [ ] Mở từng ảnh: che thông tin nhạy cảm trong ảnh; xóa metadata nếu báo cáo có ghi `[metadata: …]`.
- [ ] Điền `[[THIẾU ALT]]`, `[[THIẾU MÔ TẢ]]` (cột Notion `Description` là tiếng Anh; `vi.mdx` cần description
      tiếng Việt riêng); xử lý `[[ẢNH CHƯA TẢI…]]`, `[[ẢNH EXTERNAL KHÔNG TẢI…]]`, `[chưa hỗ trợ: …]`, link nội bộ Notion.
- [ ] Đổi `> **[Callout …]**` thành `<Callout type="…">` (ADR 0012): `pnpm writeups:promote <slug>` đổi cú pháp thành
      `type="note"`, bạn tự chọn đúng loại (tldr/critical/insight/fix).
- [ ] Soát dòng có `&#101;xport`/`&#105;mport` (script đã vô hiệu dòng ESM, MDX sẽ chạy nếu là `export` thô); giữ
      character reference hoặc viết lại câu.
- [ ] HackTheBox: xác nhận phòng đã retired rồi đặt `retired: true`.
- [ ] Chuyển `_import/<slug>/vi.md` thành `content/writeups/<slug>/vi.mdx` (kèm `images/`) bằng
      `pnpm writeups:promote <slug>` (hoặc `--all`; đích đã có thì bỏ qua, `--force` để ghi đè). Script chỉ đổi
      cú pháp callout, chuẩn hóa alt rỗng thành `[[THIẾU ALT]]` và copy ảnh; KHÔNG đổi `draft`, KHÔNG xóa `_import/`,
      và in danh sách việc tay (description, alt, loại callout). Đặt `draft: false` khi sẵn sàng.
- [ ] Chạy đủ định nghĩa hoàn thành (`test:dist` chặn flag chưa che lần nữa), rồi mở MR.
