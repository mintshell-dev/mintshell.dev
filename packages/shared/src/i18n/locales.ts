export const locales = ['vi', 'en'] as const;

export type Locale = (typeof locales)[number];

/** Tiếng Việt ở gốc `/`, không tiền tố (ADR 0004). */
export const defaultLocale: Locale = 'vi';
