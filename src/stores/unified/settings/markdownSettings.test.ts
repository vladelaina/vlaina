import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/config';
import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import { selectMarkdownSettings, selectMarkdownThemeSettings } from './markdownSettings';

describe('markdown settings selectors', () => {
  it('returns stable object snapshots while the source settings reference is unchanged', () => {
    const state = {
      data: {
        settings: {
          markdown: {
            ...DEFAULT_SETTINGS.markdown,
            body: { ...DEFAULT_SETTINGS.markdown.body },
            codeBlock: { ...DEFAULT_SETTINGS.markdown.codeBlock },
            theme: { ...DEFAULT_SETTINGS.markdown.theme },
          },
        },
      } as UnifiedData,
    };

    expect(selectMarkdownSettings(state)).toBe(selectMarkdownSettings(state));
    expect(selectMarkdownThemeSettings(state)).toBe(selectMarkdownThemeSettings(state));
  });
});
