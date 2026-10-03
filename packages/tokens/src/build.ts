import { mkdir, writeFile } from 'node:fs/promises';

import { generateCss, generateTs } from './generate.ts';

const outDir = new URL('../dist/', import.meta.url);

await mkdir(outDir, { recursive: true });
await writeFile(new URL('tokens.css', outDir), generateCss());
await writeFile(new URL('tokens.ts', outDir), generateTs());
