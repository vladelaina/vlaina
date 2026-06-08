import type { ColorModePreference, ResolvedColorMode } from '@/lib/theme/colorModeSync';
import type { MarkdownThemePlatform } from './types';

export type MarkdownThemeColorScheme = ResolvedColorMode;
export type MarkdownThemeColorSchemeMode = 'app' | 'fixed-light';

interface ImportedMarkdownThemeColorSchemeInput {
  importedThemeId: string | null;
  importedThemePlatform: MarkdownThemePlatform | null;
  appColorScheme: MarkdownThemeColorScheme;
}

interface ImportedMarkdownThemeColorModePreferenceInput {
  importedThemeId: string | null;
  importedThemePlatform: MarkdownThemePlatform | null;
  appPreference: ColorModePreference;
}

function usesFixedLightImportedMarkdownTheme({
  importedThemeId,
  importedThemePlatform,
}: {
  importedThemeId: string | null;
  importedThemePlatform: MarkdownThemePlatform | null;
}): boolean {
  return Boolean(importedThemeId && importedThemePlatform !== 'obsidian');
}

export function resolveImportedMarkdownThemeColorScheme({
  importedThemeId,
  importedThemePlatform,
  appColorScheme,
}: ImportedMarkdownThemeColorSchemeInput): {
  colorScheme: MarkdownThemeColorScheme;
  mode: MarkdownThemeColorSchemeMode;
} {
  if (usesFixedLightImportedMarkdownTheme({ importedThemeId, importedThemePlatform })) {
    return {
      colorScheme: 'light',
      mode: 'fixed-light',
    };
  }

  return {
    colorScheme: appColorScheme,
    mode: 'app',
  };
}

export function resolveImportedMarkdownThemeColorModePreference({
  importedThemeId,
  importedThemePlatform,
  appPreference,
}: ImportedMarkdownThemeColorModePreferenceInput): ColorModePreference {
  if (usesFixedLightImportedMarkdownTheme({ importedThemeId, importedThemePlatform })) {
    return 'light';
  }

  return appPreference;
}
