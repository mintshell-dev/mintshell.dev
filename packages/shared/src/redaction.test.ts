import { describe, expect, it } from 'vitest';

import { isRedactedFlag } from './redaction.ts';

describe('isRedactedFlag', () => {
  it.each([
    'redacted',
    'REDACTED',
    'Redacted',
    '[REDACTED]',
    '[redacted]',
    '<redacted>',
    '<REDACTED>',
    '__redacted__',
    '__REDACTED__',
    '_redacted_',
    '-redacted-',
    '--redacted--',
    '(redacted)',
    '{REDACTED}',
    '*redacted*',
    '  [ REDACTED ]  ',
  ])('coi %j là đã che', (inner) => {
    expect(isRedactedFlag(inner)).toBe(true);
  });

  it.each([
    'a1b2c3d4e5f67890a1b2c3d4e5f67890',
    'a1b2c3d4e5f6',
    '5f4dcc3b5aa765d61d8327deb882cf99',
    'Fl4g_s3cr3t',
    'th1s_1s_r34l',
    'redacted_a1b2c3',
    'a1b2_redacted',
    '[REDACTED]a1b2',
    'not redacted at all',
    'redactedd',
    'REDACT',
    '...',
    '',
  ])('coi %j là KHÔNG che (flag lộ hoặc không phải placeholder)', (inner) => {
    expect(isRedactedFlag(inner)).toBe(false);
  });
});
