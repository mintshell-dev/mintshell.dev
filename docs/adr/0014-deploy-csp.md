# ADR 0014 — Deploy Worker static assets qua GitLab CI, CSP chặt, security.txt

Ngày: 2026-10-06 · Trạng thái: Đã chấp nhận · Mốc: M5 · Thay một phần [ADR 0003](0003-gitlab-ci-cloudflare.md)
(Cloudflare Pages → Worker static assets)

## Bối cảnh

Site là SSG thuần (`apps/web/dist`). Project Cloudflare "mintshell" được tạo bằng "Upload your static files" trong
giao diện mới, nên là **Worker chỉ có static assets**, không phải Pages. Cần:

- Một cổng duy nhất chạy mọi kiểm tra (lint, typecheck, test, `test:dist`, audit, quét secret) trước khi xuất bản.
- CSP chỉ `'self'`. Các mốc trước đã chuẩn bị cho việc này: không script/style nội tuyến, không `style=`, không
  `data:` ngoài ảnh (ADR 0006, 0007, 0009, 0012).
- Ngoại lệ wasm cho Pagefind (ADR 0010).

## Quyết định

### Deploy: GitLab CI build + `wrangler deploy`, không dùng Cloudflare build từ Git

- `.gitlab-ci.yml`: `install → check (lint, typecheck, test, format:check) → build (build + test:dist) → security
(pnpm audit, gitleaks, semgrep) → deploy`.
  - MR chạy tới hết `security`, không deploy.
  - `deploy` chỉ chạy trên `main` protected khi pipeline là `push`, dùng đúng `dist` của `build:production`.
    Có `resource_group: production` để hai lần deploy không chạy chồng nhau.
- **Vì sao không để Cloudflare build từ Git**:
  1. CI là cổng duy nhất. Cloudflare build không chạy `test:dist` (chặn flag chưa che, script nội tuyến, kiểm tra
     CSP), audit hay gitleaks; nếu cả hai cùng build thì có hai đường xuất bản, một đường không được kiểm tra.
  2. Không cấp cho Cloudflare quyền đọc repo GitLab. Cloudflare chỉ nhận artifact đã qua kiểm tra; token CI chỉ có
     Workers Scripts: Edit.
  3. Tái lập được: image Node ghim phiên bản, lockfile frozen, `minimumReleaseAge`, `allowBuilds`.
- `apps/web/wrangler.toml`:
  - Không có `main` (chỉ assets), `assets.directory = "./dist"`.
  - `html_handling = "drop-trailing-slash"`: với `build.format: 'file'` (ADR 0007), `/en` → `en.html`,
    `/writeups.html` → 307 `/writeups`, `/x/` → `/x`.
  - `not_found_handling = "404-page"`: đường dẫn lạ trả `404.html` gần nhất, dưới `/en/` là `en/404.html`.
  - `workers_dev = false`, `preview_urls = false`: chỉ một origin công khai. Không có origin thứ hai trùng nội dung
    nằm ngoài HSTS `includeSubDomains`.
  - Không khai báo `routes`: token không có quyền zone. Custom domain `mintshell.dev` gắn trên dashboard.
  - Đã thử bằng `wrangler dev`: `/en`, `/en/writeups` (không xung đột `en.html`/`en/`), redirect `.html` và `/`
    cuối, 404 theo ngôn ngữ, `_headers` không bị phục vụ.
- **Token: cô lập chính là Environment scope, `unset` chỉ là lớp phụ** (review M5 H1):
  - **Cô lập chính (ngoài repo, tác giả cấu hình trên GitLab)**: hai biến `CLOUDFLARE_API_TOKEN`,
    `CLOUDFLARE_ACCOUNT_ID` có Environment scope `production`, nên GitLab chỉ đưa chúng vào job có
    `environment: production` (job `deploy`). Các job khác không bao giờ nhận token, đây là cô lập thật.
  - **Không có Protected Environments**: GitLab gói miễn phí cho personal project không có tính năng này. Thay vào
    đó, token được cô lập bằng ba lớp:
    1. Environment scope `production`: chỉ job deploy nhận token.
    2. Điều kiện `$CI_COMMIT_REF_PROTECTED == "true"` trong rule của `deploy`: deploy chỉ chạy trên nhánh bảo vệ.
    3. Protected branch `main`: chỉ merge qua MR.

    Với dự án một người, đây là cô lập tương đương Protected Environment. Nếu sau này có cộng tác viên hoặc chuyển
    project vào group, thêm Protected Environment `production` để giới hạn ai được deploy.

  - Biến Masked + Protected: pipeline MR từ nhánh không protected không có token.
  - **Lớp phụ, phòng thủ thừa**: job không phải deploy chạy `unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID` trong
    `before_script`. Đây **không** phải ranh giới bảo mật: biến đã được đưa vào job trước khi `unset`, và job mới
    quên `unset` hay `after_script` vẫn nhận token. Lớp này chỉ có tác dụng khi scope bị cấu hình sai.
  - wrangler đọc token từ môi trường, không truyền qua tham số, không echo.
  - Job deploy (có token) không dùng cache và chỉ cài gói `web`, không chạy lifecycle script nào (kể cả script của
    workspace, thứ `allowBuilds` không quản) và không nạp `.pnpmfile`:
    `pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile --filter web`. Rủi ro còn lại: chính wrangler
    và cây phụ thuộc của nó chạy cùng token (review M2); giảm bằng lockfile frozen, `minimumReleaseAge`, token hẹp.
- **Build sạch**: `.turbo` không được cache giữa pipeline, đặt `TURBO_FORCE=true`, `rm -rf apps/web/dist` trước
  build (file thừa từ build cũ, ghi chú M3b).
- **Cache**:
  - Chỉ cache store pnpm (khóa theo `pnpm-lock.yaml`). Không cache `node_modules`: link lại từ store mất vài giây
    và mỗi job có cây sạch đúng lockfile.
  - Khóa store có `$CI_COMMIT_REF_PROTECTED`, cộng setting "separate caches for protected branches" của GitLab: MR
    (kể cả khi tự sửa `.gitlab-ci.yml`) không ghi được vào store mà job `main` dùng. Job deploy không dùng cache
    store (review M1).
- **Cache ảnh OG** (ADR 0012, review M3c L2):
  - Job `build` của MR cache `apps/web/node_modules/.cache/og` với khóa `og-$CI_COMMIT_REF_SLUG`, mỗi nhánh một
    cache.
  - `build:production` (`main`) **không khai báo cache OG** và xóa thư mục đó trước khi build. Ảnh đi ra production
    luôn được render lại từ mã nguồn, không thể bị một MR gài sẵn.
- `typecheck` (turbo) phụ thuộc thêm `^build`: `@mintshell/tokens` xuất `dist/tokens.ts` sinh lúc build. Trên máy
  dev file luôn có sẵn nên trước đây không lộ, còn checkout sạch thì `astro check` fail.

### Security stage

- `pnpm audit --audit-level high`: fail khi có lỗ hổng high/critical. Chỉ đọc lockfile.
- `gitleaks` (`zricethezav/gitleaks:v8.30.1`, cùng bản với Dev Container): `GIT_DEPTH: 0`, quét toàn lịch sử nhánh,
  `--redact`.
- **semgrep chỉ mang tính tư vấn, không phải cổng chặn** (`allow_failure: true`):
  - Rule `p/javascript`, `p/typescript` tải từ Semgrep Registry lúc chạy. Rule không ghim nên kết quả đổi theo thời
    gian, và đây là một kết nối ra ngoài.
  - Không vendor rule vào repo: Semgrep Rules License v1.0 không cho phân phối lại, mà repo công khai và có mirror
    GitHub.
  - Tự viết bộ rule riêng thì tái lập được, nhưng chưa thử được trong container (tường lửa), nên để sau.
  - Chỉ báo mức ERROR, `--metrics=off`.

### CSP và security headers: `_headers` trong assets

- Worker static assets đọc `_headers` trong thư mục assets, cùng cú pháp với Pages, nên không cần code Worker
  (giữ "không backend"). Nguồn là `apps/web/public/_headers`, Astro chép sang `dist/`, file không bị phục vụ.
- `/*`:
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none';
form-action 'self'`. Không `unsafe-inline`/`unsafe-eval`.
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` (2 năm). Chưa `preload`: rất khó gỡ, tác giả
    tự quyết sau.
  - `Permissions-Policy` tắt mọi quyền không dùng.
  - `X-Frame-Options: DENY` (cho trình duyệt cũ), `Cross-Origin-Opener-Policy: same-origin`,
    `Cross-Origin-Resource-Policy: same-origin` (site tự chứa, chặn trang khác nhúng tài nguyên).
- **Ngoại lệ CORP cho ảnh OG, chỉ `/og/*`**: gỡ CORP chung (`! Cross-Origin-Resource-Policy`), đặt
  `Cross-Origin-Resource-Policy: cross-origin`. Ảnh OG tồn tại để site ngoài (Facebook, X, LinkedIn, client chat) tải và hiển thị; CORP
  `same-origin` sẽ chặn những client tải ảnh trực tiếp từ trình duyệt (review L4). Phải gỡ trước, nếu không
  Cloudflare nối thành `same-origin, cross-origin`, giá trị không hợp lệ.
- **Ngoại lệ wasm, chỉ cho `/search`, `/en/search`, `/pagefind/*`**: thêm `'wasm-unsafe-eval'` vào `script-src` và
  `worker-src 'self'`.
  - Luật tìm kiếm **phải** gỡ CSP chung bằng `! Content-Security-Policy`. Khi nhiều luật cùng đặt một header,
    Cloudflare nối giá trị bằng dấu phẩy, trình duyệt áp **cả hai** policy và bản không có wasm thắng.
  - Đã thử bằng `wrangler dev`: `/search` có đúng một CSP.
  - Worker Pagefind tạo bằng `new Worker(url)` cùng origin, không dùng `blob:`/`eval`. Worker nhận CSP từ response
    của `/pagefind/pagefind-worker.js`.
- `test:dist`:
  - `headers.check.ts` parse `_headers`, kiểm tra đúng tập chỉ thị, không nguồn ngoài, wasm chỉ ở 3 luật trên và có
    gỡ CSP chung, đủ các header khác, và chỉ trang tìm kiếm nạp Pagefind.
  - Đã thử đột biến: thêm `unsafe-inline`, bỏ `!`, wasm ở `/*`, thêm host ngoài, bỏ `base-uri`, HSTS ngắn. Lần nào
    test cũng fail.
  - `wrangler.check.ts` kiểm các dòng cấu hình quyết định routing.

### Cloudflare Web Analytics: chưa bật ở M5

- Beacon RUM bắt buộc phải có script ngoài. M5 giữ CSP chỉ `'self'`, tạm dùng analytics phía server của Cloudflare
  (không JS, không cookie).
- Nếu M6 bật beacon, chỉ mở đúng 2 domain: `script-src https://static.cloudflareinsights.com` và `connect-src
https://cloudflareinsights.com` (cập nhật `headers.check.ts` cho phép chính xác 2 domain này).
- Tắt auto-inject trên dashboard nếu không dùng, để CSP không chặn và không sinh lỗi console.

### security.txt

- `/.well-known/security.txt` (RFC 9116), nguồn ở `apps/web/public/.well-known/`, gồm `Contact: mailto:hi@mintshell.dev`,
  `Expires`, `Preferred-Languages: vi, en`, `Canonical`.
- Chưa có khóa PGP: chỉ để comment, không đặt URI giả.
- `security-txt.check.ts` fail khi `Expires` còn dưới 30 ngày hoặc vượt quá 1 năm. Pipeline đỏ đúng lúc cần gia hạn.

## Dependency và image mới

- `wrangler` 4.147.0 (devDependency `web`, `catalog:`): cách deploy chính thức cho Worker assets, kèm `wrangler dev`
  để thử header/routing ở local.
  - Cây phụ thuộc kéo thêm `workerd`, `miniflare`, `esbuild` 0.28.1 và `sharp` 0.35.4 (miniflare ghim cứng, khác bản
    0.35.5 của repo, không có install script).
  - `allowBuilds: workerd: false`: postinstall chỉ kiểm tra/tải lại binary, mà binary đã có qua `@cloudflare/workerd-*`.
    Đã thử `wrangler --version` và `wrangler dev` chạy được.
- Image: `node:24.21.0-bookworm` (khớp Dev Container), `zricethezav/gitleaks:v8.30.1`, `semgrep/semgrep:1.100.0`.
  Tag chưa ghim digest vì tường lửa container không tra được registry; nên ghim `@sha256:` sau.

### Review bảo mật M5: rủi ro chấp nhận

- `img-src` giữ `data:` theo yêu cầu (hiện không trang nào dùng `data:image`). Có thể bỏ khi chắc không cần (review L1).
- `/pagefind/*` cũng áp cho 404 dưới `/pagefind/` (CSP có wasm). Không có script inline hay nguồn ngoài nên ảnh
  hưởng không đáng kể; giữ luật wildcard cho đơn giản (L2).
- Chưa có `report-to` (không backend nhận báo cáo) và Trusted Types. `require-trusted-types-for 'script'` nên thử bằng
  Report-Only sau (L3).
- gitleaks `--verbose` in tác giả/email của commit có phát hiện. Các email này vốn đã nằm trong lịch sử Git công
  khai (L8).

## Hệ quả

- ADR 0003 vẫn đúng ở phần GitLab/GitLab CI/Cloudflare. Hai điểm đổi: hosting là Worker static assets, và MR không
  có bản preview deploy (chỉ build + kiểm tra). Muốn có preview thì cần token/Worker riêng, quyết sau.
- `infra/` (dự kiến ở ADR 0003) không cần: header và security.txt nằm trong `apps/web/public/`, `wrangler.toml`
  cạnh `dist`.
- Thêm nguồn ngoài sau này (Brevo `form-action` ở M6, analytics) phải sửa cả `_headers` lẫn `headers.check.ts`.
- `wrangler dev` không thay được kiểm tra trên production: checklist sau deploy nằm trong `docs/progress.md`.
