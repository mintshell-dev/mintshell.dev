import { describe, expect, it } from 'vitest';

import { isListed, type ListingData } from './listing';

const base: ListingData = { draft: false, translation: 'done' };
const locales = ['vi', 'en'] as const;

describe('isListed', () => {
  it.each(locales)('%s: bài đã dịch, không draft, không fixture thì hiện', (locale) => {
    expect(isListed(base, locale, false)).toBe(true);
    expect(isListed(base, locale, true)).toBe(true);
  });

  it.each(locales)('%s: fixture không bao giờ hiện (cả dev)', (locale) => {
    expect(isListed({ ...base, fixture: true }, locale, false)).toBe(false);
    expect(isListed({ ...base, fixture: true }, locale, true)).toBe(false);
  });

  it.each(locales)('%s: draft chỉ hiện ở dev', (locale) => {
    expect(isListed({ ...base, draft: true }, locale, false)).toBe(false);
    expect(isListed({ ...base, draft: true }, locale, true)).toBe(true);
  });

  it.each(locales)('%s: translation pending không hiện (cả dev, cả production)', (locale) => {
    expect(isListed({ ...base, translation: 'pending' }, locale, false)).toBe(false);
    expect(isListed({ ...base, translation: 'pending' }, locale, true)).toBe(false);
  });
});
