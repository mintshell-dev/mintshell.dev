# ADR 0013 — Kéo bài Notion thủ công về `_import/` (`notion:pull`)

Ngày: 2026-10-05 · Trạng thái: Đã chấp nhận · Mốc: M4

## Bối cảnh

Bài write-up được soạn nháp trong Notion (database "Mintshell": Title, Status, Slug, Platform, Room, Room URL,
Difficulty, Tags, Vuln classes, Date) rồi mới đưa vào Git. Nội dung lấy từ Notion là **dữ liệu ngoài, không tin cậy**:
có thể còn flag, IP hay dấu nhắc terminal chưa che (lộ danh tính), ảnh chụp màn hình còn metadata, HTML/JSX thô, link
lạ. Site là SSG, không backend; Notion không được gọi lúc build hay lúc chạy. Bài ValenFind đã được chuyển tay và
soát kỹ; quy trình M4 giữ nguyên tinh thần đó.

## Quyết định

### Kéo thủ công, an toàn mặc định: chỉ kéo về để soát, không xuất bản

- `pnpm notion:pull` (`scripts/notion-pull.ts`) kéo các bài có Status = Ready về
  `content/writeups/_import/<slug>/vi.md` (+ `images/`).
- `_import/` nằm trong `.gitignore` (việc đầu tiên của M4), và collection `writeups` bỏ qua thư mục bắt đầu bằng `_`
  (ADR 0009), file cũng là `.md` chứ không phải `.mdx`: bài nháp không bao giờ bị build hay commit nhầm.
- Frontmatter luôn có `draft: true`, `translation: pending`; trường không có cột Notion (`description`) hoặc cần
  người xác nhận (`retired` cho HackTheBox) được ghi chỗ để `[[…]]` để schema chặn tới khi tác giả điền.
- Script **chỉ báo, không sửa, không xóa** khi thấy cảnh báo. Tác giả tự soát, tự chuyển sang
  `content/writeups/<slug>/vi.mdx`, rồi đi qua MR như mọi thay đổi khác.
- `_import/` còn được chặn commit bằng hook pre-commit (xem mục "Chặn commit nhầm `_import/`").
- Thư mục `_import/<slug>/` đã có thì bỏ qua (đang soát dở), trừ khi có `--force`. Ghi nguyên tử: toàn bộ bài được ghi
  vào thư mục tạm rồi mới thay bản cũ, nên lỗi giữa chừng (API, tải ảnh, ghi file) không làm mất phần đang soát.

### Gọi Notion API bằng `fetch`, 0 dependency, token chỉ-đọc

- Không dùng `@notionhq/client`: chỉ cần 3 endpoint (đọc schema database, query, block con), `fetch` của Node 24 là
  đủ; ít bề mặt chuỗi cung ứng hơn cho đoạn mã cầm token.
- Integration Notion chỉ bật quyền "Read content". Token chỉ nằm trong `.env` (gitignore), nạp bằng
  `node --env-file-if-exists=.env` (tính năng sẵn của Node). Token chỉ đi trong header `Authorization` tới
  `api.notion.com`; không gửi tới host ảnh; thông báo lỗi được lọc để token không bao giờ bị in ra.
- Phân trang đầy đủ (`has_more`/`next_cursor`), request tuần tự, retry 429/5xx theo `Retry-After` (tối đa 3 lần),
  timeout 30 s, đệ quy block con tối đa 8 tầng (không đi vào trang/database con).

### Ghim `Notion-Version: 2022-06-28`

- Bản 2025-09-03 tách database thành `data_sources` (query qua `/v1/data_sources/{id}/query`). Bản 2022-06-28 vẫn dùng
  `POST /v1/databases/{id}/query`, đơn giản hơn và đủ cho một database một nguồn dữ liệu.
- Nâng cấp sau này: lấy `data_sources[0].id` từ `GET /v1/databases/{id}`, đổi endpoint query, cập nhật hằng số
  `NOTION_VERSION` và test `api.test.ts`.

### Chuyển đổi và quét

- Block → Markdown: heading (lùi một cấp, `#` dành cho tiêu đề trang), đoạn, code (giữ ngôn ngữ, đổi tên sang Prism),
  danh sách, to-do, trích dẫn, callout (`> **[Callout 💡]**` để tác giả chọn loại `<Callout>`, ADR 0012), ảnh, bảng,
  divider. Block lạ ghi `[chưa hỗ trợ: <type>]` và vẫn giữ nội dung con.
- **MDX biến chữ thành mã ở ba chỗ**, script chặn cả ba khi tác giả đổi sang `.mdx`:
  - `{…}` và `<…>`: chữ thường được escape (``\ ` * _ [ ] { } < ~``). Đã thử trên Astro thật: `\{1+1\}` hiện
    nguyên chữ, `\<img … onerror>` thành văn bản.
  - Dòng bắt đầu bằng `import`/`export` (ESM, **chạy lúc build**, kể cả trong CI): chữ cái đầu đổi thành character
    reference (`&#101;xport`, `&#105;mport`) và có cảnh báo. Review bảo mật M4 (H1) phát hiện thiếu sót này; đã thử
    trên Astro thật: dòng `export const …` thô bị nuốt thành mã, bản `&#101;xport` hiện đúng chữ.
  - Code block giữ nguyên (không bị MDX thực thi).
  - Escape là lớp phòng thủ thứ nhất, **không thay cho bước soát tay**: tác giả vẫn phải đọc từng dòng trước khi
    đổi sang `.mdx`.
- Link chỉ giữ `http(s):`/`mailto:`; scheme lạ bị bỏ (giữ chữ) và cảnh báo; link nội bộ Notion bị cảnh báo; link tới
  file đính kèm Notion (URL S3 có chữ ký) bị bỏ href. Mention người dùng Notion (thường là tên thật) bị cảnh báo.
- Ảnh luôn được tải (URL Notion là URL S3 có chữ ký, hết hạn nhanh, không được chép ra file hay báo cáo): chỉ https,
  tối đa 10 MiB, kiểu xác định bằng magic bytes (PNG/JPEG/GIF/WebP), **SVG bị từ chối**; caption làm alt, thiếu thì
  `[[THIẾU ALT]]`. Chuyển hướng được theo **thủ công** (tối đa 3 lần), kiểm tra từng bước trước khi gửi request: chỉ
  https, chặn `localhost`, IP literal không công khai (kể cả dạng `2130706433`, `0x7f.1`), mọi IPv6 literal.
- Quét sau khi ghi, in bảng + `file:dòng` (báo thừa còn hơn bỏ sót):
  - flag chưa che (`THM|HTB|flag{…}`, allowlist giá trị đã che giống `test:dist`) và chuỗi 32 hex (flag
    user.txt/root.txt của HackTheBox, hoặc hash);
  - mọi IPv4 (kèm nhãn riêng tư/tài liệu/công khai…);
  - **mọi** `user@host`/`user㉿host` ở bất kỳ đâu (code block, inline code, chữ thường, email);
  - đường dẫn home lộ tên người dùng (`/home/<tên>`, `/Users/<tên>`, `C:\Users\<tên>`);
  - metadata ảnh (PNG `tEXt/iTXt/zTXt/eXIf`, JPEG Exif/XMP/IPTC/COM, WebP EXIF/XMP, GIF Comment/XMP).
  - Dòng **TỔNG KẾT** luôn in cuối cùng kèm câu nhắc "CHƯA xuất bản gì". Ký tự điều khiển C0/C1 trong chuỗi từ Notion
    bị lọc trước khi in (escape ANSI/OSC không xóa được dòng cảnh báo).
  - Chưa quét: IPv6, chữ trong ảnh (phải tự mở xem).
- Hằng số schema (platforms, difficulties, `TITLE_MAX`, regex slug) chép sang script vì `astro/zod` không resolve được
  từ gốc repo; `frontmatter.test.ts` so khớp với `apps/web/src/schemas/writeup.ts` và chạy frontmatter sinh ra qua
  `writeupSchema` thật.

### Nơi chạy: trong Dev Container, ở một terminal riêng tách khỏi Claude Code

- `notion:pull` chạy **trong Dev Container** như mọi lệnh khác, nhưng ở **một terminal riêng**, tách khỏi terminal
  đang chạy Claude Code. Không chạy ngoài container.
- Lý do tách terminal: script cầm token nhạy cảm và nạp dữ liệu ngoài không tin cậy. Chạy ở terminal riêng nghĩa là
  token và output thô của Notion không đi vào ngữ cảnh của agent: agent không bao giờ cần token, không đọc `.env`, và
  nội dung Notion chưa soát không thành "chỉ dẫn" cho agent (giảm rủi ro prompt injection).
- Tường lửa Dev Container mở cố định `api.notion.com` và `prod-files-secure.s3.us-west-2.amazonaws.com` trong
  `init-firewall.sh` (tác giả thêm, commit `5ce04e0`; agent không sửa file này). Lý do ở mục dưới.
- Script chỉ dùng Node + `fetch`, không phụ thuộc Claude Code. Agent viết và kiểm thử bằng dữ liệu mẫu, không gọi
  Notion thật.

### Tường lửa: hai host Notion luôn mở (2026-10-06)

- `api.notion.com` và `prod-files-secure.s3.us-west-2.amazonaws.com` (ảnh Notion) nằm cố định trong danh sách cho
  phép của `init-firewall.sh`, nên luôn mở trong mọi phiên container, kể cả khi không chạy `notion:pull`.
- Rủi ro chính là **dữ liệu đi ra ngoài**, không phải dữ liệu đi vào: agent không có `NOTION_TOKEN` nên không đọc
  được dữ liệu Notion của tác giả, nhưng nếu agent bị prompt injection kèm token Notion của kẻ tấn công, nó có thể
  gửi dữ liệu trong container (mã nguồn, nháp) lên workspace của kẻ đó qua `api.notion.com`.
- Rủi ro này tương đương các host đã mở sẵn: `gitlab.com` và `api.anthropic.com` cũng nhận dữ liệu gửi kèm
  token/khóa của kẻ tấn công theo cách tương tự. Mở thêm Notion chỉ thêm một đường cùng loại với các đường đã có.
- Chấp nhận hướng này vì tiện (không phải sửa tường lửa mỗi lần chạy `notion:pull`) và rủi ro tăng thêm không đáng
  kể. Đánh đổi: nới lỏng nhẹ vùng cô lập của container. Nếu cần siết, chuyển sang mở hai host thủ công chỉ khi chạy
  `notion:pull` rồi đóng lại.

### Ảnh external mặc định không tải

- Ảnh Notion lưu (`type: file`, URL S3 có chữ ký) luôn được tải. Ảnh `external` (host bất kỳ) mặc định **không tải**:
  tải từ host lạ làm lộ IP thật của tác giả cho host đó (review M4, M2). Bài ghi chú
  `[[ẢNH EXTERNAL KHÔNG TẢI: <url>]]`, báo cáo liệt kê URL; tác giả tự tải nếu tin host, hoặc chạy lại với
  `--external-images`.
- Khi bật `--external-images`, ảnh external vẫn qua mọi kiểm tra ở trên (https, chặn host nội bộ, magic bytes, SVG).

### Chặn commit nhầm `_import/`: hook pre-commit do tác giả thêm thủ công

- `.gitignore` chặn `git add`, nhưng `git add -f` vẫn đưa được file vào index. Thêm hook `no-notion-import` vào
  `.pre-commit-config.yaml` để commit nào chứa file trong `content/writeups/_import/` đều bị chặn.
- **Hook này do tác giả tự thêm thủ công** vào `.pre-commit-config.yaml`; agent không sửa file đó (CLAUDE.md). Nội dung
  (dán nguyên khối, giữ thụt lề 6 khoảng trắng, vào cuối danh sách `hooks:` của `repo: local`; `language: fail` là
  loại hook có sẵn của pre-commit, không cần script hay dependency):

  <!-- prettier-ignore -->
  ```yaml
        - id: no-notion-import
          name: chặn nháp Notion (content/writeups/_import/)
          # Nháp kéo bằng `pnpm notion:pull` có thể còn flag/IP/tên máy chưa che. .gitignore chặn
          # `git add`, hook này chặn cả `git add -f` (ADR 0013).
          entry: nháp Notion trong content/writeups/_import/ không bao giờ được commit (ADR 0013)
          language: fail
          files: ^content/writeups/_import/
  ```

- Đã thử bằng bản chép cấu hình ở `/tmp` (không đụng file thật): file trong `_import/` → Failed; bài thật → Skipped;
  `git add -f` rồi chạy hook trên index → Failed.
- Không bỏ qua hook (`--no-verify`) theo quy tắc repo.

### Phương án không chọn

- **Đồng bộ trong CI / tự mở MR**: cần đưa token vào CI và tự động hóa bước xuất bản; trái nguyên tắc "người soát
  trước khi xuất bản".
- **Ghi thẳng vào `content/writeups/<slug>/`**: bài chưa soát có thể bị build, commit hoặc lộ flag.
- **`@notionhq/client` hoặc thư viện Notion → Markdown**: thêm dependency cho việc `fetch` làm được; thư viện chuyển
  đổi không escape cho MDX.
- **Tự che flag/IP, tự xóa metadata**: dễ che sai hoặc sót mà người dùng tưởng đã an toàn; giữ quyết định ở người soát.
- **Mở/đóng tường lửa thủ công mỗi lần chạy `notion:pull`**: chặt hơn nhưng phải sửa `init-firewall.sh` mỗi lần,
  trong khi rủi ro tăng thêm khi mở cố định không đáng kể (mục "Tường lửa: hai host Notion luôn mở"). Giữ làm
  phương án siết lại nếu cần.

## Hệ quả

- Thêm `@types/node` (`catalog:`, đã có trong lockfile) vào devDependencies gốc; `pnpm typecheck` chạy thêm
  `tsc -p scripts`. ESLint/Vitest ở gốc đã bao `scripts/`.
- Không đưa `notion:pull` vào turbo hay CI. `apps/web/turbo.json` loại `content/writeups/_import/**` khỏi inputs của
  `build`: glob input tường minh của turbo không tôn trọng `.gitignore`, nên nếu không loại thì mỗi lần kéo bài làm
  build cache miss.
- Còn mở: `rehype-sanitize` và tự gắn `rel` cho link ngoài trong thân MDX (ADR 0009) vẫn chưa làm; phòng tuyến hiện
  tại là bước soát tay, `inline.check` của `test:dist` và CSP ở M5.
- Nếu nâng Notion-Version, xem mục "Ghim `Notion-Version`" ở trên.
