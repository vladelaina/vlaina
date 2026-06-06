import { describe, expect, it } from 'vitest';
import {
  applyMarkdownThemeRuntimeAttributes,
  resolveMarkdownThemeViewport,
} from './markdownThemeRuntime';

describe('markdownThemeRuntime', () => {
  it('resolves Obsidian-like viewport classes from width', () => {
    expect(resolveMarkdownThemeViewport(390)).toBe('mobile');
    expect(resolveMarkdownThemeViewport(900)).toBe('tablet');
    expect(resolveMarkdownThemeViewport(1440)).toBe('desktop');
  });

  it('applies native platform, external layer, color scheme, viewport, and imported theme attributes', () => {
    const element = document.createElement('div');

    applyMarkdownThemeRuntimeAttributes(element, {
      importedThemeId: 'minimal',
      importedThemePlatform: 'obsidian',
      colorScheme: 'dark',
      viewport: 'mobile',
      typewriterMode: true,
    });

    expect(element.dataset.markdownThemeRoot).toBe('true');
    expect(element.dataset.markdownThemePlatform).toBe('obsidian');
    expect(element.dataset.markdownCompat).toBe('external');
    expect(element.dataset.markdownCompatLayer).toBe('external');
    expect(element.dataset.markdownImportedTheme).toBe('minimal');
    expect(element.dataset.theme).toBe('dark');
    expect(element.classList.contains('theme-vlaina')).toBe(false);
    expect(element.classList.contains('theme-external-markdown')).toBe(true);
    expect(element.classList.contains('theme-obsidian')).toBe(true);
    expect(element.classList.contains('theme-typora')).toBe(false);
    expect(element.classList.contains('typora-export')).toBe(false);
    expect(element.classList.contains('typora-export-content')).toBe(false);
    expect(element.classList.contains('theme-dark')).toBe(true);
    expect(element.classList.contains('is-live-preview')).toBe(true);
    expect(element.classList.contains('max')).toBe(true);
    expect(element.classList.contains('is-readable-line-width')).toBe(true);
    expect(element.classList.contains('is-mobile')).toBe(true);
    expect(element.classList.contains('is-phone')).toBe(true);
    expect(element.classList.contains('ty-on-typewriter-mode')).toBe(true);
    expect(element.classList.contains('theme-light')).toBe(false);
    expect(element.classList.contains('is-desktop')).toBe(false);
  });

  it('applies Typora platform state for Typora imported themes', () => {
    const element = document.createElement('div');

    applyMarkdownThemeRuntimeAttributes(element, {
      importedThemeId: 'vlook-fancy',
      importedThemePlatform: 'typora',
      colorScheme: 'light',
      viewport: 'desktop',
      typewriterMode: false,
    });

    expect(element.dataset.markdownThemePlatform).toBe('typora');
    expect(element.classList.contains('theme-typora')).toBe(true);
    expect(element.classList.contains('theme-obsidian')).toBe(false);
    expect(element.classList.contains('typora-export')).toBe(true);
    expect(element.classList.contains('typora-export-content')).toBe(true);
  });

  it('removes stale imported theme id and mutually exclusive classes', () => {
    const element = document.createElement('div');

    applyMarkdownThemeRuntimeAttributes(element, {
      importedThemeId: 'clean-light',
      importedThemePlatform: 'typora',
      colorScheme: 'dark',
      viewport: 'desktop',
      typewriterMode: true,
    });
    applyMarkdownThemeRuntimeAttributes(element, {
      importedThemeId: null,
      importedThemePlatform: null,
      colorScheme: 'light',
      viewport: 'tablet',
      typewriterMode: false,
    });

    expect(element.dataset.markdownThemeRoot).toBe('true');
    expect(element.dataset.markdownThemePlatform).toBe('vlaina');
    expect(element.dataset.markdownCompat).toBe('native');
    expect(element.dataset.markdownCompatLayer).toBe('native');
    expect(element.dataset.markdownImportedTheme).toBeUndefined();
    expect(element.classList.contains('theme-vlaina')).toBe(true);
    expect(element.classList.contains('theme-external-markdown')).toBe(false);
    expect(element.classList.contains('theme-typora')).toBe(false);
    expect(element.classList.contains('theme-obsidian')).toBe(false);
    expect(element.classList.contains('typora-export')).toBe(false);
    expect(element.classList.contains('typora-export-content')).toBe(false);
    expect(element.classList.contains('theme-dark')).toBe(false);
    expect(element.classList.contains('theme-light')).toBe(true);
    expect(element.classList.contains('is-live-preview')).toBe(true);
    expect(element.classList.contains('max')).toBe(true);
    expect(element.classList.contains('is-readable-line-width')).toBe(true);
    expect(element.classList.contains('is-phone')).toBe(false);
    expect(element.classList.contains('is-desktop')).toBe(false);
    expect(element.classList.contains('is-tablet')).toBe(true);
    expect(element.classList.contains('ty-on-typewriter-mode')).toBe(false);
  });
});
