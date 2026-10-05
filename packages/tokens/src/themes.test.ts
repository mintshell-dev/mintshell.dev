import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast.ts';
import { flatten, sources, type TokenNode } from './generate.ts';

const AA_TEXT = 4.5;
const NON_TEXT = 3;

const themes = { dark: sources.dark, light: sources.light } as const;

const textColors = ['text', 'muted', 'accent', 'highlight'] as const;
const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
const backgrounds = ['bg', 'surface'] as const;
// Màu tô cú pháp (Prism) hiển thị trên nền khối code (color.surface): chữ nên ≥ 4.5:1.
const syntaxColors = [
  'keyword',
  'string',
  'comment',
  'number',
  'function',
  'punctuation',
  'operator',
  'variable',
] as const;

const keys = (tree: TokenNode) => flatten(tree).map((t) => t.path.join('.'));

describe('theme', () => {
  it('tối và sáng có cùng tập token', () => {
    expect(keys(sources.light)).toEqual(keys(sources.dark));
  });

  describe.each(Object.entries(themes))('%s: tương phản WCAG AA', (_name, theme) => {
    for (const bg of backgrounds) {
      it.each(textColors)(`color.%s trên color.${bg} ≥ 4.5:1`, (fg) => {
        expect(
          contrastRatio(theme.color[fg].$value, theme.color[bg].$value),
        ).toBeGreaterThanOrEqual(AA_TEXT);
      });

      it.each(severities)(`severity.%s trên color.${bg} ≥ 4.5:1`, (level) => {
        expect(
          contrastRatio(theme.severity[level].$value, theme.color[bg].$value),
        ).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }

    // WCAG 1.4.11: ranh giới thành phần tương tác (nút, ô nhập) cần ≥ 3:1.
    it.each(backgrounds)('color.borderStrong trên color.%s ≥ 3:1', (bg) => {
      expect(
        contrastRatio(theme.color.borderStrong.$value, theme.color[bg].$value),
      ).toBeGreaterThanOrEqual(NON_TEXT);
    });

    // Biểu tượng thương hiệu (BrandMark) là thành phần đồ họa (WCAG 1.4.11): ≥ 3:1.
    it.each([
      ['accent', 'bg'],
      ['text', 'bg'],
      ['bg', 'text'],
    ] as const)('đồ họa thương hiệu: color.%s trên color.%s ≥ 3:1', (fg, bg) => {
      expect(contrastRatio(theme.color[fg].$value, theme.color[bg].$value)).toBeGreaterThanOrEqual(
        NON_TEXT,
      );
    });

    it.each(syntaxColors)('color.syntax.%s trên color.surface ≥ 4.5:1', (name) => {
      expect(
        contrastRatio(theme.color.syntax[name].$value, theme.color.surface.$value),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // Callout MDX (ADR 0012): nhãn màu theo loại và thân chữ, đều trên nền color.surface.
    it.each([
      ['tldr', theme.color.accent.$value],
      ['critical', theme.severity.critical.$value],
      ['insight', theme.color.highlight.$value],
      ['note', theme.severity.low.$value],
      ['fix', theme.color.muted.$value],
      ['thân (color.text)', theme.color.text.$value],
    ])('callout %s trên color.surface ≥ 4.5:1', (_type, fg) => {
      expect(contrastRatio(fg, theme.color.surface.$value)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('color.onAccent trên color.accent ≥ 4.5:1', () => {
      expect(
        contrastRatio(theme.color.onAccent.$value, theme.color.accent.$value),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });
});
