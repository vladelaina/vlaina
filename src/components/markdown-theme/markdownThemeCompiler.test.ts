import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportedMarkdownTheme } from '@/lib/markdown/theme-compatibility/types';
import {
  clearCompiledImportedMarkdownThemeStyles,
  compileImportedMarkdownThemeStyles,
  MAX_IN_FLIGHT_THEME_PRELOADS,
  preloadCompiledImportedMarkdownThemeStyles,
} from './markdownThemeCompiler';

const mocks = vi.hoisted(() => ({
  readImportedMarkdownTheme: vi.fn(),
  scopeImportedMarkdownThemeCss: vi.fn((css: string, _platform: string, scope: string) => `${scope} { ${css} }`),
  sanitizeImportedMarkdownThemeCss: vi.fn((css: string) => css.replace('unsafe', 'safe')),
  buildImportedAppThemeCss: vi.fn((_css: string, id: string, _platform: string) => `:root[data-vlaina-imported-app-theme="${id}"] {}`),
  buildImportedMarkdownThemePostBridgeCss: vi.fn((id: string, platform: string) => `${id}:${platform}:post`),
}));

vi.mock('@/lib/markdown/theme-compatibility/importedThemeStorage', () => ({
  readImportedMarkdownTheme: (id: string) => mocks.readImportedMarkdownTheme(id),
}));

vi.mock('@/lib/markdown/theme-compatibility/cssScoping', () => ({
  scopeImportedMarkdownThemeCss: (css: string, platform: string, scope: string) =>
    mocks.scopeImportedMarkdownThemeCss(css, platform, scope),
}));

vi.mock('@/lib/markdown/theme-compatibility/cssUrls/security', () => ({
  sanitizeImportedMarkdownThemeCss: (css: string) => mocks.sanitizeImportedMarkdownThemeCss(css),
}));

vi.mock('@/lib/markdown/theme-compatibility/appThemeBridge', () => ({
  buildImportedAppThemeCss: (css: string, id: string, platform: string) =>
    mocks.buildImportedAppThemeCss(css, id, platform),
}));

vi.mock('@/lib/markdown/theme-compatibility/postBridge', () => ({
  buildImportedMarkdownThemePostBridgeCss: (id: string, platform: string) =>
    mocks.buildImportedMarkdownThemePostBridgeCss(id, platform),
}));

function importedTheme(theme: Partial<ImportedMarkdownTheme> = {}): ImportedMarkdownTheme {
  return {
    id: 'clean-light',
    name: 'Clean Light',
    platform: 'typora',
    cssFile: 'clean-light.css',
    sourcePath: null,
    createdAt: 1,
    updatedAt: 1,
    css: '#write h1 { color: unsafe; }',
    ...theme,
  };
}

describe('markdownThemeCompiler', () => {
  beforeEach(() => {
    clearCompiledImportedMarkdownThemeStyles();
    vi.clearAllMocks();
  });

  it('caches compiled styles for repeated theme switches in the same session', async () => {
    const theme = importedTheme();

    const first = await compileImportedMarkdownThemeStyles(theme);
    const second = await compileImportedMarkdownThemeStyles({ ...theme });

    expect(second).toBe(first);
    expect(mocks.sanitizeImportedMarkdownThemeCss).toHaveBeenCalledTimes(1);
    expect(mocks.scopeImportedMarkdownThemeCss).toHaveBeenCalledTimes(1);
    expect(mocks.buildImportedAppThemeCss).toHaveBeenCalledTimes(1);
    expect(mocks.buildImportedAppThemeCss).toHaveBeenCalledWith(
      '#write h1 { color: safe; }',
      'clean-light',
      'typora'
    );
    expect(mocks.buildImportedMarkdownThemePostBridgeCss).toHaveBeenCalledTimes(1);
    expect(first.markdownCss).toContain('safe');
  });

  it('does not reuse compiled styles when the CSS content changes', async () => {
    const theme = importedTheme();

    await compileImportedMarkdownThemeStyles(theme);
    await compileImportedMarkdownThemeStyles({
      ...theme,
      css: '#write h1 { color: blue; }',
    });

    expect(mocks.scopeImportedMarkdownThemeCss).toHaveBeenCalledTimes(2);
  });

  it('rejects compiled theme CSS that expands beyond the output budget', async () => {
    mocks.scopeImportedMarkdownThemeCss.mockReturnValueOnce('x'.repeat(3 * 1024 * 1024 + 1));

    await expect(compileImportedMarkdownThemeStyles(importedTheme())).rejects.toThrow(
      'Imported markdown theme CSS output is too large.',
    );

    mocks.scopeImportedMarkdownThemeCss.mockReturnValueOnce('#write { color: safe; }');
    const compiled = await compileImportedMarkdownThemeStyles(importedTheme());
    expect(compiled.markdownCss).toBe('#write { color: safe; }');
  });

  it('deduplicates concurrent preloads for the same theme id', async () => {
    mocks.readImportedMarkdownTheme.mockResolvedValue(importedTheme());

    preloadCompiledImportedMarkdownThemeStyles('clean-light');
    preloadCompiledImportedMarkdownThemeStyles('clean-light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.readImportedMarkdownTheme).toHaveBeenCalledTimes(1);
    expect(mocks.scopeImportedMarkdownThemeCss).toHaveBeenCalledTimes(1);
  });

  it('bounds concurrent preloads for different theme ids', () => {
    mocks.readImportedMarkdownTheme.mockReturnValue(new Promise(() => undefined));

    for (let index = 0; index < MAX_IN_FLIGHT_THEME_PRELOADS + 5; index += 1) {
      preloadCompiledImportedMarkdownThemeStyles(`theme-${index}`);
    }

    expect(mocks.readImportedMarkdownTheme).toHaveBeenCalledTimes(MAX_IN_FLIGHT_THEME_PRELOADS);
  });
});
