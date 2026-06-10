import { beforeEach, describe, expect, it } from 'vitest';
import type { ImportedMarkdownTheme } from '@/lib/markdown/theme-compatibility/types';
import {
  clearCompiledImportedMarkdownThemeStyles,
  compileImportedMarkdownThemeStyles,
} from './markdownThemeCompiler';

function importedTheme(theme: Partial<ImportedMarkdownTheme> = {}): ImportedMarkdownTheme {
  return {
    id: 'broken',
    name: 'Broken',
    platform: 'obsidian',
    cssFile: 'broken.css',
    sourcePath: null,
    createdAt: 1,
    updatedAt: 1,
    css: '#write { color: red',
    ...theme,
  };
}

describe('markdownThemeCompiler malformed CSS handling', () => {
  beforeEach(() => {
    clearCompiledImportedMarkdownThemeStyles();
  });

  it('compiles malformed imported CSS to empty scoped CSS instead of rejecting', async () => {
    const compiled = await compileImportedMarkdownThemeStyles(importedTheme());

    expect(compiled.markdownCss).toBe('');
    expect(compiled.appCss).toBe('');
    expect(compiled.postBridgeCss).toBe('');
  });
});
