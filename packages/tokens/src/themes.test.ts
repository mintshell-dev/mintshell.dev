import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast.ts';
import { flatten, sources, type TokenNode } from './generate.ts';

const AA_TEXT = 4.5;

const themes = { dark: sources.dark, light: sources.light } as const;

const textColors = ['text', 'muted', 'accent', 'highlight'] as const;
const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
const backgrounds = ['bg', 'surface'] as const;

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

    it('color.onAccent trên color.accent ≥ 4.5:1', () => {
      expect(
        contrastRatio(theme.color.onAccent.$value, theme.color.accent.$value),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });
});
