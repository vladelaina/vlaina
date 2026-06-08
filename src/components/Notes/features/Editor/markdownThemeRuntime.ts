import {
  resolveImportedMarkdownThemeColorScheme,
  type MarkdownThemeColorScheme,
  type MarkdownThemeColorSchemeMode,
} from '@/lib/markdown/theme-compatibility/colorScheme';
import type { MarkdownThemePlatform } from '@/lib/markdown/theme-compatibility/types';

export type {
  MarkdownThemeColorScheme,
  MarkdownThemeColorSchemeMode,
};
export type MarkdownThemeViewport = 'mobile' | 'tablet' | 'desktop';

export interface MarkdownThemeRuntimeState {
  importedThemeId: string | null;
  importedThemePlatform: MarkdownThemePlatform | null;
  colorScheme: MarkdownThemeColorScheme;
  colorSchemeMode?: MarkdownThemeColorSchemeMode;
  viewport: MarkdownThemeViewport;
  typewriterMode: boolean;
}

const TYPORA_DOCUMENT_CLASSES = [
  'typora-export',
  'typora-export-content',
  'typora-node',
] as const;

const TYPORA_OS_CLASSES = [
  'html-for-mac',
  'os-linux',
  'os-mac',
  'os-windows',
] as const;

export function resolveMarkdownThemeViewport(width: number): MarkdownThemeViewport {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export const resolveMarkdownThemeRuntimeColorScheme = resolveImportedMarkdownThemeColorScheme;

export function resolveTyporaRuntimePlatformClasses(
  platform = globalThis.navigator?.platform ?? '',
  userAgent = globalThis.navigator?.userAgent ?? ''
): string[] {
  const fingerprint = `${platform} ${userAgent}`.toLowerCase();

  if (/\bmac|darwin|iphone|ipad|ipod/.test(fingerprint)) {
    return ['html-for-mac', 'os-mac'];
  }
  if (/\bwin/.test(fingerprint)) {
    return ['os-windows'];
  }
  if (/\blinux|x11|wayland/.test(fingerprint)) {
    return ['os-linux'];
  }

  return [];
}

export function applyMarkdownThemeRuntimeAttributes(
  element: HTMLElement,
  state: MarkdownThemeRuntimeState
): void {
  const hasImportedTheme = Boolean(state.importedThemeId);
  const platform = hasImportedTheme ? state.importedThemePlatform ?? 'external' : 'vlaina';

  element.dataset.markdownThemeRoot = 'true';
  element.dataset.markdownThemePlatform = platform;
  element.dataset.markdownCompat = hasImportedTheme ? 'external' : 'native';
  element.dataset.markdownCompatLayer = hasImportedTheme ? 'external' : 'native';
  element.dataset.theme = state.colorScheme;
  element.dataset.markdownThemeColorScheme = state.colorScheme;
  element.dataset.markdownThemeColorSchemeMode = state.colorSchemeMode ?? 'app';

  if (state.importedThemeId) {
    element.dataset.markdownImportedTheme = state.importedThemeId;
  } else {
    delete element.dataset.markdownImportedTheme;
  }

  element.classList.toggle('theme-vlaina', !hasImportedTheme);
  element.classList.toggle('theme-typora', hasImportedTheme && state.importedThemePlatform === 'typora');
  element.classList.toggle('theme-obsidian', hasImportedTheme && state.importedThemePlatform === 'obsidian');
  element.classList.toggle('theme-external-markdown', hasImportedTheme);
  for (const className of TYPORA_DOCUMENT_CLASSES) {
    element.classList.toggle(className, hasImportedTheme && state.importedThemePlatform === 'typora');
  }
  const typoraPlatformClasses = new Set(
    hasImportedTheme && state.importedThemePlatform === 'typora'
      ? resolveTyporaRuntimePlatformClasses()
      : []
  );
  for (const className of TYPORA_OS_CLASSES) {
    element.classList.toggle(className, typoraPlatformClasses.has(className));
  }
  element.classList.toggle('theme-dark', state.colorScheme === 'dark');
  element.classList.toggle('theme-light', state.colorScheme === 'light');
  element.classList.add('is-live-preview');
  element.classList.add('max');
  element.classList.add('is-readable-line-width');
  element.classList.toggle('is-mobile', state.viewport === 'mobile');
  element.classList.toggle('is-phone', state.viewport === 'mobile');
  element.classList.toggle('is-tablet', state.viewport === 'tablet');
  element.classList.toggle('is-desktop', state.viewport === 'desktop');
  element.classList.toggle('ty-on-typewriter-mode', state.typewriterMode);
}
