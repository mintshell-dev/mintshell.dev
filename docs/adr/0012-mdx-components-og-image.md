# ADR 0012 — Thành phần nội dung MDX và ảnh cover Open Graph

Ngày: 2026-10-05 · Trạng thái: Đã chấp nhận · Mốc: M3c

## Bối cảnh

Write-up cần khối nhấn mạnh (TL;DR, mức nghiêm trọng, cách khắc phục), sơ đồ chuỗi tấn công và
ảnh cover khi chia sẻ link. Các ràng buộc vẫn giữ nguyên:

- CSP M5 chỉ cho `'self'`: không script hay style nội tuyến, không `style=`, không ảnh URL ngoài.
- Màu và font chỉ lấy từ token; font tự host.
- Song ngữ vi/en; không backend, không gọi dịch vụ ngoài lúc build.

## Quyết định

### Component MDX truyền qua `components`, không import trong bài

- `Callout.astro` và `AttackChain.astro` nằm trong `apps/web/src/components/mdx/`. `mdxComponents` truyền chúng vào `<Content components={…}>` ở hai trang chi tiết write-up.
- Bài MDX gọi `<Callout>`/`<AttackChain>` mà không cần đường dẫn import tương đối. Đổi vị trí component cũng không phải sửa nội dung, và pipeline Notion (M4) chỉ cần sinh thẻ.
- **Callout**: `type` thuộc `tldr | critical | insight | note | fix`; loại lạ làm build lỗi.
  - Nhãn lấy từ từ điển (`callout.*`) theo ngôn ngữ của URL trang; prop `title` ghi đè nhãn.
  - Màu viền/nhãn: `accent`, `severity.critical`, `highlight`, `severity.low`, `muted`.
  - Viền trái dùng token mới `border.width.accent` (3px).
  - Tương phản ≥ 4.5:1 trên `color.surface` ở cả hai theme, có test riêng trong `packages/tokens`.
- **AttackChain**: props được validate bằng Zod (`lib/mdx.ts`); sai thì build lỗi.
  - Là SVG nội tuyến `role="img"` + `aria-label` (nhận qua prop), kèm `<figcaption>` nhìn thấy được.
  - Bước có `critical: true` (mặc định là bước cuối) dùng `severity.critical`, bước khác dùng `accent`.
- **SVG an toàn CSP**:
  - Mũi tên vẽ bằng `path`, không dùng `<marker>`, vì `marker-end="url(#…)"` bị `brand.check` cấm (không `url(`, không `//`).
  - Không `xmlns` (HTML nội tuyến không cần).
  - Màu chỉ qua class CSS; thuộc tính `fill`/`stroke` chỉ được là `none`/`currentColor`.
- **Responsive**:
  - Chữ mono có độ rộng đoán trước được (~0.6em). `wrapText` ngắt dòng lúc build (chuẩn hoá NFC, cắt cứng từ quá dài) và chiều cao ô tính theo số dòng.
  - viewBox rộng 400, `width: 100%`, tối đa token `size.figure` (28rem).
  - Ở màn 320px chữ vẫn khoảng 11px trở lên; trên desktop không phóng quá ~1.1 lần.

### Ảnh OG: endpoint tĩnh Astro + sharp + font tự host đổi WOFF1 → TTF

- **Endpoint prerender**:
  - `/og/writeups/<slug>.png` (vi) và `/og/en/writeups/<slug>.png` (en) sinh từ frontmatter: `title`, `platform`, `difficulty`, `vulnClasses`, slug, locale.
  - `/og/default.png` cho trang không có cover riêng: trang thường, 404, bản en `pending`.
  - Hai ngôn ngữ có hai ảnh vì tiêu đề khác nhau. `ogImagePath()` dùng chung cho endpoint và `BaseLayout`.
- **Render** (`lib/og/render.ts`):
  - Nền SVG gồm khung, con ốc mờ (path dùng chung với `BrandMark` qua `lib/brand-paths.ts`) và các chip, rasterize bằng librsvg.
  - Chữ dựng bằng Pango qua `sharp({ text })`: handle `mintshell_`, dòng lệnh giả, tiêu đề (tối đa 3 dòng, thu cỡ rồi cắt `…`), nền tảng · độ khó, chip loại lỗi (`+N` khi tràn). Sau đó `composite` thành PNG.
  - SVG nền chỉ chứa số và màu token. Chữ từ frontmatter chỉ đi qua Pango markup, đã escape (`escapeMarkup`) và bỏ ký tự điều khiển.
- **Màu**: token theme tối (`@mintshell/tokens`). Đây là ngoại lệ "màu trong file ảnh" của design system: ảnh không đọc được CSS variable.
- **Font**:
  - `@fontsource` chỉ phát hành WOFF/WOFF2, và FreeType trong sharp **bỏ qua cả hai mà không báo lỗi** (đã thử).
  - `lib/og/woff.ts` đổi WOFF 1.0 → SFNT bằng `node:zlib` (khoảng 60 dòng, có test với font thật) rồi ghi TTF vào thư mục tạm.
  - Mỗi font cần cả hai subset `latin` và `vietnamese`. Pango ghép glyph giữa hai file; spike đã xác nhận đủ dấu tiếng Việt.
- **Guard font**: render cùng một chuỗi bằng font thật và bằng một family không tồn tại. Nếu hai ảnh trùng nhau, nghĩa là Pango đang dùng font dự phòng, build lỗi. Đã thử đột biến (family `Be Vietnam Pro` thiếu `SemiBold` → build fail).
  - Tên family phải đúng như bảng `name` và có dấu phẩy cuối (`'Be Vietnam Pro SemiBold, 56'`). Thiếu dấu phẩy, Pango hiểu "SemiBold" là weight và lặng lẽ dùng font khác.
- **Cache theo nội dung** (`lib/og/cache.ts`):
  - Khóa là `sha256` của dấu vân tay renderer + dữ liệu thẻ.
  - Dấu vân tay gồm mã nguồn `src/lib/og/*.ts` (trừ test) và `brand-paths.ts`, bảng màu token, bytes TTF và `sharp.versions`. Nhờ vậy đổi code, màu, font hay sharp thì cache tự mất hiệu lực, không cần nhớ tăng số phiên bản.
  - Thư mục cache là `apps/web/node_modules/.cache/og/`, đã gitignore cùng `node_modules`.
  - Đọc: chỉ dùng lại file là PNG 1200×630, nếu không thì render lại. Ghi: file tạm + `rename`.
  - Sửa thân bài không render lại ảnh. Build log in `[og] cache|render <id>`.
- **Dependency**: `sharp` 0.35.5 khai báo devDependency của `web`, ghim `catalog:`.
  - Gói đã có sẵn trong lockfile cùng phiên bản (optional dependency của `astro`), không tải gói mới.
  - Không có install script (binary prebuilt `@img/*`), nên `allowBuilds` không đổi.

### Giới hạn độ dài tiêu đề: 120 ký tự

- `title` trong `writeupSchema` có `TITLE_MAX = 120` (sau trim); vượt thì build lỗi (`InvalidContentEntryDataError`, thông báo nhắc giới hạn và ADR này).
- **Lý do: bảo vệ bố cục ảnh OG.** Tiêu đề chỉ có 3 dòng. Tiêu đề dài hơn sẽ bị cắt `…` trên ảnh chia sẻ, và `fitTitle` phải render lại một lần cho mỗi từ (build chậm). Báo lỗi lúc viết bài tốt hơn là lặng lẽ xuất ảnh cắt chữ.
- **Số đo** (renderer thật: Be Vietnam Pro SemiBold, rộng 1040px, cùng mốc 3 dòng như `fitTitle`):

  | Mẫu tiêu đề                       | Vừa 3 dòng ở 56px | Vừa 3 dòng ở 46px |
  | --------------------------------- | ----------------- | ----------------- |
  | Câu tiếng Việt                    | ≤ 111 ký tự       | ≤ 135             |
  | Câu tiếng Anh Title Case          | ≤ 99              | ≤ 124             |
  | Toàn chữ hoa rộng (W/M), cực đoan | ≤ 62              | ≤ 83              |

- **Chọn 120**: thấp hơn ngưỡng 46px của cả hai ngôn ngữ (124–135), nên tiêu đề thường luôn hiện đủ. Con số 200 không khớp bố cục: tiêu đề 125–200 ký tự sẽ bị cắt. Tiêu đề hiện có: ValenFind vi 102, en 92 ký tự.
- **Lưới an toàn**: trường hợp cực đoan (toàn chữ hoa rộng) vẫn có thể vượt 3 dòng dưới 120 ký tự. Renderer giữ bước cắt `…` cho trường hợp đó, không làm hỏng ảnh.
- Zod đếm theo đơn vị UTF-16: chữ Việt NFC nằm trong BMP nên 1 ký tự = 1 đơn vị; chữ NFD đếm dài hơn, tức chặt hơn.
- Đổi cỡ chữ, độ rộng hay số dòng tiêu đề trên ảnh thì **đo lại và cập nhật `TITLE_MAX`**.

### Phương án không chọn

- **satori (+ resvg-js)**: dựng chữ thành path từ WOFF1, không cần đổi font. Nhưng phải thêm một dependency (satori và cây phụ thuộc gồm yoga WASM). resvg-js là native binary thứ hai, trùng vai trò với sharp. Chỉ dùng làm dự phòng nếu spike Pango thất bại, và spike đã đạt.
- **Dịch vụ OG bên ngoài / `@vercel/og`**: trái non-goal "không gọi dịch vụ ngoài", và cũng kéo satori + resvg.
- **Ảnh tĩnh vẽ tay cho từng bài**: không mở rộng được, dễ lệch khi đổi tiêu đề.
- **Rasterize SVG có `<text>` bằng librsvg**: librsvg không đọc `@font-face`, vẫn cần fontconfig và TTF như cách đã chọn, nhưng lại không tự ngắt dòng.

## Hệ quả

- `BaseLayout` có prop `ogImage` (đường dẫn cùng origin; origin lạ thì build lỗi) và `ogImageAlt`. Mọi trang có đúng một `og:image` + `twitter:image` (`summary_large_image`), kèm kích thước, type, alt.
- `test:dist`:
  - `og.check`: mỗi trang có đúng một `og:image` cùng origin; file là PNG 1200×630 không metadata; mỗi write-up công khai có cover riêng khác ảnh mặc định; trang khác dùng ảnh mặc định; `dist/og` chỉ chứa PNG hợp lệ.
  - `content-components.check`: loại và nhãn callout theo ngôn ngữ; sơ đồ có `role="img"` + `aria-label` và đúng bước critical; không `style=`, script hay `on*=` trong khối.
- **Giới hạn cache**:
  - CI chỉ hưởng lợi nếu giữ `apps/web/node_modules/.cache/og` giữa các lần chạy (cấu hình cache GitLab CI ở M5).
  - Thư mục cache không tự dọn ảnh mồ côi khi tiêu đề hay renderer đổi; có thể xóa bất kỳ lúc nào.
  - Build phải chạy với cwd là `apps/web` (pnpm/turbo đã làm vậy), nếu không thì báo lỗi rõ ràng.
  - **Cache poisoning (review bảo mật L2)**: cache chỉ kiểm tra PNG 1200×630, không kiểm nội dung, và khóa tính lại được từ mã nguồn công khai. Nếu M5 dùng chung cache CI giữa các nhánh/MR, một MR độc có thể gài sẵn ảnh đúng tên khóa để bản build `main` xuất bản. Bắt buộc ở M5: khóa cache CI theo nhánh (`$CI_COMMIT_REF_SLUG`) và **không dùng cache OG cho job deploy `main`/protected** (build sạch).
- Parser WOFF chặn zip bomb: trần `totalSfntSize` 16 MiB, `inflateSync` có `maxOutputLength` bằng độ dài khai báo (thử đột biến: bỏ giới hạn → test fail), tổng bảng phải khớp header.
- Chữ trên ảnh bỏ ký tự điều khiển (`\p{Cc}`) và ký tự định dạng vô hình (`\p{Cf}`: bidi override, zero-width); màu token được assert `#RRGGBB` trước khi vào markup.
- MDX chứa component có style làm Vite cảnh báo `MODULE_LEVEL_DIRECTIVE "use astro:head-inject"` khi bundle. Đây chỉ là cảnh báo: CSS của Callout/AttackChain vẫn có trong stylesheet của trang (đã kiểm tra trong `dist`).
- Thêm loại callout mới cần làm cả ba việc: thêm vào `calloutTypes`, thêm khóa `callout.*` vi/en, thêm màu trong test tương phản.
