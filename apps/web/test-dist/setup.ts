import { existsSync } from 'node:fs';

import { DIST } from './dist-files';

export default function setup(): void {
  if (!existsSync(new URL('index.html', DIST))) {
    throw new Error(
      `Chưa có bản build ở ${DIST.pathname}: chạy \`pnpm build\` trước, hoặc \`pnpm test:dist\` ở gốc (turbo tự build).`,
    );
  }
}
