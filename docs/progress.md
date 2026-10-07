# Tiến độ

Quỹ thời gian: 5–10 giờ/tuần, mỗi mốc khoảng 1 tuần. Định nghĩa hoàn thành: [workflow.md](workflow.md).

**Tiếp theo: duyệt M6a-2 (SEO), merge; sau deploy gửi sitemap lên Search Console và chạy checklist sau deploy của M5.**

| Mốc   | Mục tiêu                                                  | Trạng thái | ADR                                                                          |
| ----- | --------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| M0    | Khung monorepo                                            | Xong       | [0001](adr/0001-typescript-monorepo.md)–[0005](adr/0005-lint-format-test.md) |
| M1    | Design token                                              | Xong       | [0006](adr/0006-design-token-pipeline.md)                                    |
| M2a   | Layout chung, menu, chuyển theme và ngôn ngữ              | Xong       | [0007](adr/0007-layout-theme-url.md)                                         |
| M2b   | Portfolio và hiệu ứng                                     | Xong       | [0008](adr/0008-portfolio-data-css-motion.md)                                |
| M3a   | Khung write-up (collection, trang, tô màu cú pháp)        | Xong       | [0009](adr/0009-writeup-content-model.md)                                    |
| M3b   | Pagefind, RSS, trang chủ                                  | Xong       | [0010](adr/0010-search-feed.md)                                              |
| M3c   | Callout, sơ đồ chuỗi tấn công, ảnh cover OG               | Xong       | [0012](adr/0012-mdx-components-og-image.md)                                  |
| M3    | Nội dung (bài thật)                                       | Đang làm   | —                                                                            |
| M4    | Đồng bộ Notion (thủ công)                                 | Chờ duyệt  | [0013](adr/0013-notion-manual-pull.md)                                       |
| M5    | CI/CD, security headers, security.txt                     | Chờ duyệt  | [0014](adr/0014-deploy-csp.md)                                               |
| M6a-1 | Số liệu thật và link công khai cho portfolio              | Chờ duyệt  | [0008](adr/0008-portfolio-data-css-motion.md) (bổ sung)                      |
| M6a-2 | SEO: sitemap, robots.txt, og:type=article, hreflang       | Chờ duyệt  | [0015](adr/0015-sitemap-seo.md)                                              |
| M6    | Email Brevo, chính sách quyền riêng tư, analytics, ra mắt | Chưa làm   | —                                                                            |

## Mốc đã xong (tóm tắt)

Chi tiết nguyên văn từng mốc: [history/m0-m3.md](history/m0-m3.md).

- **M0**: Dev Container có tường lửa, gitleaks + `prettier --check` ở pre-commit, pnpm + Turborepo, lint/format/test, `minimumReleaseAge` + `allowBuilds`.
- **M1**: token W3C → `tokens.css`/`tokens.ts` bằng script tự viết, theme tối/sáng, test tương phản WCAG AA, font tự host.
- **M2a**: `BaseLayout` (canonical, hreflang), header/footer, đổi theme chống nháy, đổi ngôn ngữ, URL không `/` cuối, i18n trong `packages/shared`, bộ kiểm tra `test:dist`.
- **M2b**: portfolio dữ liệu YAML + Zod, hiệu ứng chỉ CSS, bộ nhận diện (favicon, `BrandMark`).
- **M3a**: collection `writeups` + schema strict, trang danh sách/chi tiết, en `pending`, Prism không `style=`, chặn flag chưa che và HTML nguy hiểm trong `test:dist`.
- **M3b**: Pagefind tĩnh, RSS vi/en, trang chủ thật, fixture draft.
- **M3c**: `Callout`, `AttackChain`, ảnh OG sinh lúc build (sharp, cache theo nội dung), `TITLE_MAX = 120`.

## M4 — Đồng bộ Notion (thủ công)

`pnpm notion:pull` kéo bài Ready về `_import/` để soát, không xuất bản ([ADR 0013](adr/0013-notion-manual-pull.md));
hướng dẫn chạy trong [workflow.md](workflow.md).

- [x] `content/writeups/_import/` vào `.gitignore` trước tiên (nháp có thể còn flag/IP chưa che); `git check-ignore` xác nhận
- [x] `scripts/notion-pull.ts` + `scripts/notion/*`: `fetch` thẳng Notion API (0 dependency), `Notion-Version 2022-06-28`,
      lọc Status = Ready (cột kiểu status hoặc select), phân trang đủ, retry 429/5xx, timeout, đệ quy block tối đa 8 tầng
- [x] Token chỉ trong `.env` (`node --env-file-if-exists`), `.env.example` chỉ có tên biến; thiếu biến → báo tên và dừng;
      token không bao giờ bị in (test với server lặp lại token trong lỗi)
- [x] Block → Markdown: heading (lùi một cấp), đoạn, code (giữ ngôn ngữ), danh sách, to-do, trích dẫn, callout, ảnh,
      bảng, divider; block lạ → `[chưa hỗ trợ: <type>]`, vẫn giữ nội dung con; escape `{ } <`… cho MDX (đã thử trên
      Astro thật: `\{1+1\}` và `\<img onerror>` hiện nguyên chữ)
- [x] Frontmatter từ các cột, `draft: true`, `translation: pending`, `[[THIẾU MÔ TẢ]]`, `retired` cần xác nhận cho
      HackTheBox; hằng số so khớp `writeup.ts` và chạy qua `writeupSchema` thật trong test
- [x] Cột Notion `Description` (tiếng Anh) → `description` của bản được kéo; rỗng/thiếu → `[[THIẾU MÔ TẢ]]` +
      cảnh báo "description rỗng". Bản dịch vi cần description tiếng Việt riêng, điền khi dịch
- [x] Slug kiểm như collection; sai/trùng → bỏ qua + cảnh báo; `_import/<slug>/` đã có → bỏ qua trừ khi `--force`
      (bản cũ chỉ bị xóa sau khi lấy được nội dung mới); slug đã xuất bản → cảnh báo
- [x] Ảnh: tải về `images/01-…`, chỉ https, ≤ 10 MiB, magic bytes PNG/JPEG/GIF/WebP, từ chối SVG, không gửi token tới
      host ảnh, không chép URL S3 có chữ ký; caption → alt, thiếu → `[[THIẾU ALT]]`
- [x] Quét (chỉ báo): flag chưa che, mọi IPv4 có nhãn, **mọi** `user@host`/`㉿` trong code, metadata ảnh; báo cáo bảng +
      `file:dòng` + danh sách ảnh; dòng **TỔNG KẾT** luôn ở cuối kèm "CHƯA xuất bản gì"
- [x] Lệnh `notion:pull` ở `package.json` gốc, không vào turbo/CI; `tsc -p scripts` vào `pnpm typecheck`;
      `@types/node` (`catalog:`, đã có trong lockfile) vào devDependencies gốc
- [x] Turbo: `apps/web/turbo.json` loại `content/writeups/_import/**` khỏi inputs của `build` (glob tường minh không
      tôn trọng `.gitignore`: trước đó thêm một file nháp làm `web:build` cache miss); đã thử: nháp → cache hit, sửa
      bài thật → miss
- [x] 100 unit test trong `scripts/notion/` (gồm end-to-end với Notion giả và thư mục tạm); không gọi Notion thật
- [x] Hướng dẫn trong `docs/workflow.md` (tường lửa 2 host do tác giả tự thêm, chạy trong container ở terminal riêng tách khỏi Claude Code, checklist chuyển
      bài); ADR 0013
- [x] Review bảo mật (security-reviewer): không có Critical. Đã sửa: **H1** dòng `import`/`export` sẽ thành ESM chạy lúc
      build khi đổi sang `.mdx` → vô hiệu bằng character reference + cảnh báo (đã thử trên Astro thật; ADR 0013 đính
      chính); **M1** quét `user@host` trên toàn văn bản (cả inline code, email), thêm chuỗi 32 hex (flag HTB), đường
      dẫn home, cảnh báo mention người dùng Notion; **M2** (một phần) theo chuyển hướng thủ công, chỉ https, chặn
      localhost/IP nội bộ (cả `2130706433`, `0x7f.1`)/IPv6 literal trước khi gửi request; **L1** escape emoji callout
      và lý do ảnh lỗi; **L2** lọc ký tự điều khiển terminal trong báo cáo; **L3** bỏ href tới URL S3 có chữ ký;
      **L4** metadata GIF, byte đệm JPEG; **L5** ghi nguyên tử (thư mục tạm → rename), lỗi tải ảnh giữa luồng không
      làm dừng run. **L6** không cần sửa: `gitleaks dir` trên `scripts/` và `.env.example` không thấy gì
- [x] Ảnh `external` mặc định KHÔNG tải (lộ IP cho host lạ), ghi chú `[[ẢNH EXTERNAL KHÔNG TẢI: url]]`, cờ
      `--external-images` để bật; ảnh Notion (S3) vẫn tải; báo cáo có cột/tổng riêng
- [x] Thống nhất câu chữ ADR 0013 + `workflow.md`: chạy trong Dev Container, ở terminal riêng tách khỏi Claude Code
      (không phải ngoài container)
- [x] Viết sẵn hook `no-notion-import` (`language: fail`, chặn cả `git add -f` vào `_import/`) trong ADR 0013; đã thử
      bằng bản chép cấu hình ở `/tmp`
- [x] Tường lửa mở cố định 2 host Notion (`api.notion.com`, `prod-files-secure.s3…`), tác giả thêm ở `5ce04e0`;
      lý do (rủi ro chính là dữ liệu đi ra ngoài, tương đương gitlab.com/api.anthropic.com) ghi trong ADR 0013
- [x] Tác giả tự dán hook `no-notion-import` vào `.pre-commit-config.yaml` (agent không sửa file này)
- [x] Tác giả chạy thật lần đầu: `pnpm notion:pull` trong container ở terminal riêng (tách khỏi Claude Code) với 1 bài Ready, chuyển bài theo
      checklist trong `workflow.md`
- [ ] Chưa làm (còn mở): quét IPv6; `rehype-sanitize`; tự gắn `rel="noopener noreferrer"` cho link ngoài trong thân MDX (hoãn từ
      M3a, review M3c L3); bản `en`

## M6a-1 — Số liệu thật và link công khai cho portfolio

Chỉ dữ liệu tác giả đưa, ghi nguyên văn; mục chưa có thì xóa để phần đó tự ẩn ([ADR 0008](adr/0008-portfolio-data-css-motion.md), bổ sung).

- [x] `content/portfolio/{vi,en}.yaml`: số liệu chỉ còn điểm TryHackMe `100k+` và số phòng `800+`; xóa mục số write-up
      và số báo cáo bug bounty (chưa có); `recognition.items: []` (chưa có chứng chỉ, phần "// ghi nhận" ẩn); bỏ comment
      mẫu `cvUrl`/`pgp` (nút CV và dòng PGP ẩn); link liên hệ chỉ còn GitHub, YouTube (bỏ HackerOne)
- [x] Schema: `LINK_HOSTS` (nhãn → hostname được phép, so khớp chính xác); nhãn lạ hoặc host sai → build lỗi; unit test
      cho `evilgithub.com`, `github.com.evil.example`, `gist.github.com`, `github.com.`, `youtu.be`, nhãn lạ, `constructor`
- [x] Chặn chỗ giữ chỗ hai lớp, chung regex `PLACEHOLDER` (`[…]`, `<…>`, `［`/`【`, `{{`, `XXXX`/`xxxx`, `TODO`, `TBD`,
      `lorem ipsum`): schema `text` từ chối lúc build (đã thử: `'[Số phòng]'` trong YAML → build lỗi đúng trường);
      `test:dist` quét cả `<head>` và thuộc tính `content`/`href`/`alt`/`title`/`aria-label`, có kiểm tra quét được
      nội dung (đã thử đột biến: `[..]` trong meta description, `XXXX` trong href, `&lt;Số phòng&gt;` → đều fail)
- [x] Review bảo mật (security-reviewer): không có Critical/High. Đã sửa: **M1** test placeholder bỏ sót `<head>` và
      thuộc tính; **M2** test âm thầm qua khi không parse được trang; **M3** regex placeholder hẹp, schema chấp nhận
      placeholder; **L1** chặn cổng trong link liên hệ (`:443` vẫn qua vì URL chuẩn hóa về mặc định); **L3** nhãn link
      trùng; **L4** ghi chú `HackerOne` trong `LINK_HOSTS` là chưa dùng. Chưa làm: **L2** allowlist path (chặn
      `youtube.com/redirect`, OAuth GitHub; YAML do tác giả viết trong Git, rủi ro thấp). Việc của tác giả: **M4**, **M5** bên dưới
- [x] Kiểm tra ở local (dev server và `dist`): đúng `100k+`, `800+`, href GitHub/YouTube đúng nguyên văn; không có HackerOne,
      nút CV, phần ghi nhận, dòng PGP
- [ ] (review M4) Tự soát hồ sơ GitHub `mintshell-dev` (tên hiển thị, email trong commit, org) và kênh YouTube
      `@mintshell32` (tên kênh, email liên hệ, mặt/giọng) không lộ danh tính thật; cân nhắc handle thống nhất
- [ ] (review M5) Tự soát hồ sơ TryHackMe công khai không lộ danh tính (100k+ điểm, 800+ phòng cùng trang tiếng Việt
      đủ để thu hẹp trên bảng xếp hạng theo quốc gia)
- [ ] Thêm khi có: số write-up, số báo cáo bug bounty, chứng chỉ, HackerOne (`https://hackerone.com/…`), CV, PGP, URL dự án
      video và cộng đồng

## M6a-2 — SEO: sitemap, robots.txt, og:type=article

Sitemap tự sinh theo cùng `isListed`, hreflang chỉ cho bản có thật, fixture `noindex` ([ADR 0015](adr/0015-sitemap-seo.md)).
0 dependency (không dùng `@astrojs/sitemap`: không ra `/sitemap.xml`, không lọc được bằng `isListed`).

- [x] `src/lib/seo.ts`: `STATIC_PATHS`, `xDefault`, `sitemapXml` (escape XML, hreflang `xhtml:link`, `lastmod` =
      `updated ?? date` cho write-up); 11 unit test
- [x] `src/pages/sitemap.xml.ts`: 24 URL (5 trang tĩnh × 2, 3 cặp vi/en, 8 bài chỉ en); không draft/fixture/pending/404/
      `/og/*`/rss
- [x] **Sửa lỗi có sẵn**: 8 bài chỉ có en khai `hreflang=vi` + `x-default` trỏ tới trang vi 404 → `BaseLayout` nhận
      `alternates` (write-up dùng `listedLocales`, cùng `isListed`), `x-default` → vi nếu có, không thì en
- [x] **Sửa lỗi có sẵn**: trang fixture index được → `noindex`, không canonical (vẫn build cho `test:dist`)
- [x] `og:type=article` + `article:published_time`/`modified_time` (khi có `updated`, chỉ ngày)/`article:tag` cho
      write-up có nội dung; trang khác (cả en pending) `website`; `<link rel="sitemap">` mọi trang
- [x] `public/robots.txt`: cho phép tất cả, chỉ `Disallow: /pagefind/`, `Sitemap: https://mintshell.dev/sitemap.xml`
- [x] `test:dist`: `sitemap.check` (XML hợp lệ, namespace, URL sạch tuyệt đối, tập `<loc>` = tập tính từ frontmatter =
      tập trang `.html` không noindex trong `dist`, không draft/fixture/pending, hreflang hai chiều, `lastmod`),
      `robots.check`, `seo.check` (hreflang chỉ trỏ trang index được + hai chiều, title/description/og:description/
      og:url = canonical/og:image cùng origin, og:type article/website, `article:*` khớp frontmatter), `writeups.check`
      (fixture noindex)
- [x] Thử đột biến 6 kiểu, đều fail đúng test: draft vào sitemap; fixture vào sitemap; hreflang luôn đủ vi/en; bỏ
      `article:published_time`; robots thiếu `Sitemap:`; thêm trang tĩnh `tmp-seo.astro` không khai `STATIC_PATHS`
      (test so sitemap với `dist` đỏ)
- [x] `wrangler dev`: `/sitemap.xml` 200 `application/xml`, `/robots.txt` 200 `text/plain; charset=utf-8`, cả hai
      nosniff + một CSP chung; không sửa `_headers`/CSP
- [x] Review bảo mật (security-reviewer): không có Critical/High/Medium; không lọt draft/fixture/pending/`_import`,
      không injection từ frontmatter, không cần nới CSP. Đã sửa: **lỗi chức năng** trang vi pending (dev, hoặc lỡ
      `draft: false`) làm `BaseLayout` throw → quy tắc một dòng "index được ⇔ bản ngôn ngữ qua `isListed`"
      (`noindex = !listedLocales.includes(locale)`, gồm cả fixture và en pending; đã thử `astro dev` `/writeups/nax`:
      200, noindex, không hreflang); **L1** export `escapeXml` và test trực tiếp (`new URL` đã percent-encode `<>"`);
      **L2** `article:tag` so đúng danh sách tag trong frontmatter (cả dạng `[a, b]` lẫn khối `- a`); **L3** `isNoindex`
      dùng `attr` thay vì regex thứ tự thuộc tính; **L6** `article:*_time` chỉ ghi ngày `YYYY-MM-DD` (không lộ giờ viết
      nếu sau này có giờ). Chấp nhận: L3 phần so khớp nguyên dòng `draft: true` (lệch đều làm test đỏ), L4 hai danh
      sách trang tĩnh (cố ý, lưới thật là so với `dist`), L5 domain ghi ở robots.txt (đã có test)
- [x] Sau khi tác giả dịch hết sang tiếng Việt (mọi bài song ngữ; số "24 URL / 8 bài chỉ en" ở trên là lúc làm mốc):
      test bài chỉ-en ở `seo.check`/`sitemap.check` thành có điều kiện (danh sách rỗng là hợp lệ, có bài chỉ-en thì
      vẫn kiểm không hreflang vi); `seo.check` tính bài chỉ-en bằng `publicSlugs` (bắt cả vi pending, không chỉ vi
      draft). Đột biến: `binex/vi.mdx` → `draft: true` thì pass và thật sự kiểm `binex`; thêm hreflang luôn đủ vi/en →
      fail ở `binex`; sitemap gán đủ vi/en cho mọi bài → fail; đã khôi phục (so `cmp` với bản sao lưu)
- [x] Ghi chú: thử đột biến bằng `pnpm test:dist` (turbo) để lại file thừa trong `dist` khi cache hit (turbo khôi phục
      output đè lên, không xóa file lạ); sau khi thử, `rm -rf apps/web/dist` rồi `TURBO_FORCE=true pnpm test:dist`
- [ ] Việc của tác giả sau deploy: gửi `https://mintshell.dev/sitemap.xml` lên Google Search Console/Bing Webmaster;
      kiểm tra `curl -I` sitemap/robots trên production
- [ ] Chưa làm: JSON-LD `Article` (script nội tuyến, cần xem lại CSP), sitemap ảnh; chưa có bài nào có `updated` nên
      nhánh `article:modified_time` mới chỉ được unit/logic test, chưa có trên dữ liệu thật

## Script chuyển write-up (`writeups:promote`)

`pnpm writeups:promote <slug>|--all [--force]` chuyển cơ học `_import/<slug>/vi.md` sang `content/writeups/<slug>/vi.mdx`
(0 dependency). Chỉ thay thế văn bản, không đọc hiểu nội dung; hướng dẫn trong [workflow.md](workflow.md).

- [x] `scripts/promote/transform.ts`: `> **[Callout …]**` → `<Callout type="note">` (không đoán loại), alt rỗng →
      `[[THIẾU ALT]]`, bỏ qua fenced code, frontmatter (cả `draft`, `translation`) và mọi dòng khác giữ nguyên byte
- [x] `scripts/promote-writeup.ts`: slug kiểm `SLUG_RE`, đường dẫn phải nằm trong thư mục cho phép, `vi.md` phải là file
      thường, đích đã có thì bỏ qua (trừ `--force`), ghi nguyên tử qua thư mục tạm, ảnh chỉ copy file thường tên an toàn,
      không bao giờ xóa `_import/`
- [x] Báo cáo mỗi bài: description còn `[[THIẾU MÔ TẢ]]`, ảnh còn `[[THIẾU ALT]]` (kèm `vi.md:<dòng>`), số khối
      callout cần chọn type, marker callout còn sót; dòng TỔNG KẾT "CHƯA đổi draft, CHƯA xóa _import/"
- [x] 23 unit test (input mẫu tự viết, thư mục tạm); chưa chạy trên bài thật
- [x] Review bảo mật (security-reviewer): không có Critical. Đã sửa: **H1** `--force` không còn xóa trước (đổi tên bản cũ, thay,
      rollback khi lỗi, giữ `en.mdx` và file anh em, chỉ thay `vi.mdx` + `images/`); **H2** quét và báo dòng MDX nguy hiểm
      (`{ }`, `<thẻ>`, `import`/`export`) ngoài code, không tự sửa; **M1** ảnh chỉ png/jpg/gif/webp, tên không `..`;
      **M2** `_import/<slug>` phải là thư mục thật (realpath); **M3** marker giả trong fence của callout không cắt khối;
      **M4** bổ sung test; **L1** từ chối `vi.md` CRLF; **L3** lọc ký tự điều khiển trong báo cáo; **L4** `.promote-*` vào
      `.gitignore`, thư mục đích chmod 0755. Chưa làm: **L2** (IMAGE bậc hai trên dòng cực dài), **L5** (quét flag; đã có
      `test:dist`), **L6** (chạy song song), TOCTOU `lstat`→`copyFile` (chạy thủ công, rủi ro thấp)
- [ ] Tác giả tự chạy trên bài thật rồi làm tay: loại callout, description, alt

## Lọc danh sách write-up theo bản ngôn ngữ

Mỗi trang danh sách chỉ liệt kê bài có bản ngôn ngữ đó thật ([ADR 0009](adr/0009-writeup-content-model.md)).

- [x] `isListed(data, locale, dev)` (`src/lib/listing.ts`): không fixture, không draft (trừ dev), `translation: done` cho
      cả vi và en; `listWriteups` dùng nó nên danh sách, trang chủ, prev/next và RSS (cả vi) cùng một quy tắc
- [x] `WriteupArticle`: `searchable` chỉ khi `translation: done` (bản vi pending không vào Pagefind)
- [x] Fixture: bộ lọc fixture vẫn đúng; `/writeups` ở dev hiện `sample-draft` vì bài này thiếu `fixture: true` (đã thêm cho
      cả vi/en; `sample-writeup` chưa từng hiện ở danh sách, cả dev lẫn bản build)
- [x] Test: unit `listing.test.ts` (fixture/draft/pending × vi/en); `test:dist` danh sách vi/en khớp đúng `publicSlugs`, không
      fixture, không bài pending cùng ngôn ngữ; `publicSlugs` bỏ pending ở cả hai ngôn ngữ. Đột biến (bỏ lọc fixture; bỏ lọc
      translation với `nax/vi.mdx` draft:false; với `tryheartme/en.mdx` pending draft:false) đều fail đúng chỗ, đối chứng qua
- [x] Đã chốt: không làm noindex/link cho trang vi pending. Chiến lược: bài chưa dịch giữ `vi.mdx` `draft: true` (không build
      trang vi), chỉ xuất bản `en.mdx`; dịch xong mới đổi vi sang `draft: false`. Nên không có trang vi pending nào tồn tại

## Việc còn mở từ các mốc đã xong

Chép nguyên văn từ chi tiết mốc.

### M2b

- [x] Dữ liệu thật đã điền ở M6a-1: số phòng TryHackMe, URL GitHub/YouTube
- [ ] Còn chờ (đang ẩn, xem M6a-1): số write-up, số báo cáo bug bounty, chứng chỉ, URL HackerOne, link CV, fingerprint PGP, URL dự án video và cộng đồng
- [x] Duyệt bản tiếng Anh của `content/portfolio/en.yaml`

### M3a

- [ ] **Hoãn sang M4** (đã chốt): tự gắn `rel`/`target` cho link ngoài trong _thân_ MDX. Astro 7
      dùng Sätteri nên rehype/remark plugin cần cài `@astrojs/markdown-remark` (không "0 dep"); sẽ
      cân nhắc cùng `rehype-sanitize` khi thêm pipeline nội dung Notion ở M4. - Khoảng trống: link ngoài trong thân MDX chưa tự có `rel="noopener noreferrer"` (metadata
      `roomUrl` thì đã có). - Rủi ro hiện tại: thấp (chỉ reverse tabnabbing; nội dung trong Git là tin cậy). - Phòng tuyến tạm: CSP ở M5; xử lý dứt điểm ở M4 cùng `rehype-sanitize`. - Viết bài thủ công: nếu muốn chắc, tự thêm `rel` vào thẻ `<a>` cho link ngoài.
- [ ] Chưa làm: trang theo tag, bình luận

### M3b

- [ ] Chưa làm (đã chốt): trang theo tag, bình luận
- [x] Sitemap: xong ở M6a-2

### M3c

- [x] Giới hạn cache OG: đã có ở M5 (cache theo nhánh cho MR, `main` build sạch; ADR 0014). CI cần giữ `apps/web/node_modules/.cache/og` giữa các lần chạy mới có lợi;
      cache không tự dọn ảnh mồ côi (xóa thư mục bất kỳ lúc nào là an toàn)
- [ ] Vite cảnh báo `MODULE_LEVEL_DIRECTIVE "use astro:head-inject"` khi MDX dùng component có style: chỉ là cảnh
      báo (CSS vẫn được nạp, đã kiểm tra); xem lại khi nâng Astro
- [ ] Thử chia sẻ link (trình xem trước OG) sau khi deploy (M5)
- [ ] Chưa làm (đã chốt): trang theo tag, cheatsheet, phân tích CVE
- [x] `og:type=article`/`article:*`: xong ở M6a-2

## Bảo trì

- [x] Vá GHSA-ch52-4w7c-c8xp: pnpm override `http-cache-semantics@<4.3.0: ^4.3.0` trong
      `pnpm-workspace.yaml`; chờ bản 4.3.0 đủ 1 ngày tuổi, không dùng `minimumReleaseAgeExclude`
      ([ADR 0011](adr/0011-override-http-cache-semantics.md))
- [ ] Gỡ override khi nâng Astro lên bản tự dùng http-cache-semantics >=4.3.0, chạy lại `pnpm audit`

## M5 — CI/CD, security headers, security.txt

Deploy Worker static assets "mintshell" bằng `wrangler` từ GitLab CI, CSP `'self'` toàn site, wasm chỉ cho tìm kiếm
([ADR 0014](adr/0014-deploy-csp.md)).

- [x] `.gitlab-ci.yml`: install → check (lint, typecheck, test, format:check) → build (build + test:dist) →
      security (pnpm audit high, gitleaks toàn lịch sử, semgrep tư vấn `allow_failure`) → deploy; MR không deploy,
      `deploy` chỉ chạy trên `main` protected + push, có `resource_group`, `environment: production`
- [x] Image `node:24.21.0-bookworm` (khớp Dev Container), cache store pnpm theo lockfile (không cache `node_modules`),
      job không phải deploy `unset` biến Cloudflare trước `pnpm install`
- [x] Build sạch: `.turbo` không cache, `TURBO_FORCE=true`, `rm -rf apps/web/dist`
- [x] Cache ảnh OG (ADR 0012, review M3c L2): MR khóa `og-$CI_COMMIT_REF_SLUG`; `build:production` không cache OG,
      xóa thư mục trước build
- [x] Sửa lỗi lộ ra khi mô phỏng CI trên worktree sạch: `typecheck` thiếu `@mintshell/tokens` (file sinh lúc build) →
      turbo `typecheck` phụ thuộc thêm `^build`
- [x] `apps/web/wrangler.toml`: chỉ assets `./dist`, `html_handling = "drop-trailing-slash"`,
      `not_found_handling = "404-page"`, `workers_dev = false`, `preview_urls = false`, không `routes`
- [x] `apps/web/public/_headers`: CSP chặt (`frame-ancestors`/`base-uri`/`object-src 'none'`, `form-action 'self'`),
      nosniff (mọi file, cả `rss.xml`), Referrer-Policy, HSTS 2 năm + includeSubDomains (chưa preload),
      Permissions-Policy tắt hết, X-Frame-Options DENY, COOP + CORP `same-origin`
- [x] Pagefind: `/search`, `/en/search`, `/pagefind/*` gỡ CSP chung (`! Content-Security-Policy`, nếu không Cloudflare
      nối hai policy và wasm bị chặn) rồi đặt CSP + `'wasm-unsafe-eval'` + `worker-src 'self'`
- [x] `/.well-known/security.txt` (RFC 9116): Contact, Expires 2027-10-01, Preferred-Languages, Canonical; PGP chỉ để comment
- [x] `test:dist`: `headers.check.ts` (thử đột biến 6 kiểu, đều fail), `security-txt.check.ts` (fail khi còn < 30
      ngày hoặc > 1 năm), `wrangler.check.ts`
- [x] Thử bằng `wrangler dev` ở local: `/en` → en.html, `/en/writeups` → danh sách (không xung đột `en.html`/`en/`),
      `/writeups.html` và `/writeups/` → 307 `/writeups`, `/en/khong-co` → 404 trang en, `/search` có đúng một CSP (bản
      wasm), `/_headers` không bị phục vụ, `security.txt` 200; `wrangler deploy --dry-run` đọc 109 file
- [x] `wrangler` 4.147.0 (devDep `web`, `catalog:`), `allowBuilds: workerd: false` (không cần postinstall, đã thử);
      `pnpm audit`: không lỗ hổng
- [x] ADR 0014; ADR 0003 ghi chú thay đổi hosting; `architecture.md`, `requirements.md`, `workflow.md` cập nhật
- [x] Review bảo mật (security-reviewer): không có Critical. Đã sửa: **M1** khóa store có
      `$CI_COMMIT_REF_PROTECTED`, deploy không dùng cache (cài thẳng từ registry); **M2** deploy cài
      `--ignore-scripts --ignore-pnpmfile --filter web` (đã thử trên worktree sạch + `wrangler deploy --dry-run`);
      **L5** test ghim đúng tập header `/*`, `wrangler.check` cấm `routes`/`[env.*]`/`run_worker_first`/`main`/bảng lạ
      (thử đột biến); **L9** `.wrangler/`, `.dev.vars*` vào `.gitignore`; **L4** luật `/og/*` đặt CORP `cross-origin` (gỡ CORP chung) để site ngoài tải được ảnh chia sẻ, còn lại giữ `same-origin`, có test và thử đột biến. Ngoài repo (việc của tác giả bên dưới):
      **H1** environment scope (Protected Environment không có ở gói Free, xem ADR 0014), **M3** digest image, **L6**, **L7**, **L10**. Chấp nhận,
      ghi trong ADR 0014: L1 (`data:` giữ theo yêu cầu), L2, L3, L8

Việc tác giả tự làm (trước/khi merge):

- [x] **(review H1, cô lập chính)** Đặt **Environment scope = `production`** cho `CLOUDFLARE_API_TOKEN`,
      `CLOUDFLARE_ACCOUNT_ID`: GitLab chỉ đưa token vào job `deploy` (`environment: production`). `unset` trong
      `before_script` của job khác vẫn giữ, nhưng chỉ là lớp phụ (ADR 0014); cân nhắc TTL cho token Cloudflare
- [x] Xác nhận `main` là protected branch: không ai push thẳng, chỉ merge qua MR (một trong ba lớp cô lập token thay
      cho Protected Environment, ADR 0014)
- [x] Bật "Prevent outdated deployment jobs" (Settings → CI/CD → General pipelines) để retry job deploy cũ không đưa
      bản cũ lên lại (review L6)
- [x] Bật "Always Use HTTPS" ở zone Cloudflare (HSTS `includeSubDomains`, review L10)
- [ ] Trả lời người báo lỗi bảo mật bằng địa chỉ "send as" `hi@mintshell.dev`, không phải hộp thư cá nhân nhận chuyển
      tiếp (lộ danh tính); xác nhận Email Routing hoạt động (review L7)
- [x] Gắn custom domain `mintshell.dev` cho Worker "mintshell" trên dashboard (token CI không có quyền zone)
- [x] Xác nhận "Use separate caches for protected branches" đang bật (Settings → CI/CD → General pipelines)
- [x] Xác minh danh tính runner (shared runner GitLab)
- [ ] Nâng `semgrep/semgrep:1.100.0` lên bản hiện tại (container không tra được Docker Hub); ghim cả ba image bằng
      `@sha256:`, ít nhất image node (chạy job deploy có token) (review M3)
- [x] Web Analytics: tắt auto-inject beacon trên dashboard cho tới M6 (nếu không CSP sẽ chặn và báo lỗi console)

Kiểm tra trên production sau deploy đầu tiên (`https://mintshell.dev`):

- [ ] `/en` phục vụ `en.html`, `/en/writeups` phục vụ `en/writeups.html` (không xung đột file `en.html` và thư mục `en/`)
- [ ] `/writeups.html` chuyển hướng về `/writeups`
- [ ] Đường dẫn không tồn tại dưới `/en/` trả mã 404 với nội dung `en/404.html`
- [ ] `curl -I` trang thường: một CSP không có wasm; `/search`, `/en/search`, `/pagefind/pagefind-worker.js`: đúng
      một CSP có `'wasm-unsafe-eval'` và `worker-src 'self'`; HSTS, nosniff (cả `rss.xml`), Permissions-Policy, CORP `same-origin`; `/og/default.png` có CORP `cross-origin`
- [ ] DevTools Console không có vi phạm CSP trên trang chủ, write-up (CSS, JS, font, ảnh, OG), portfolio, 404
- [ ] Tìm kiếm Pagefind chạy ở `/search` và `/en/search`: có kết quả, Console không có lỗi wasm/worker, tab
      Sources/Threads có worker `pagefind-worker.js` (không âm thầm chạy trên main thread)
- [ ] `/.well-known/security.txt` trả 200, `text/plain; charset=utf-8`
- [ ] Không còn `*.workers.dev` cho Worker này
- [ ] Thử chia sẻ link (trình xem trước OG) (từ M3c)
- [ ] Kiểm tra bằng securityheaders.com / Mozilla Observatory (tùy chọn)

Chưa làm (còn mở):

- [x] Sitemap: xong ở M6a-2 (tự sinh, không thêm `@astrojs/sitemap`, ADR 0015)
- [x] `og:type=article`/`article:*`: xong ở M6a-2
- [ ] Beacon Web Analytics và domain Brevo trong `form-action` (M6)
- [ ] HSTS `preload`, ký PGP cho security.txt, rule semgrep tự viết (để semgrep thành cổng chặn), preview deploy cho MR
- [ ] miniflare (qua wrangler) ghim `sharp` 0.35.4, nên lockfile có hai bản sharp (repo dùng 0.35.5): chỉ là dev tool,
      không có install script; xem lại khi nâng wrangler
- [ ] Redirect `www` → apex: cấu hình zone Cloudflare (ngoài repo)
- [ ] Protected Environment `production` khi có cộng tác viên hoặc chuyển project vào group (gói Free cho personal
      project không có, ADR 0014)
