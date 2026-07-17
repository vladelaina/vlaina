import { DEFAULT_SETTINGS } from '@/lib/config';
import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import type { MarkdownThemeSettings } from '@/lib/storage/unifiedStorageTypes';
import { isSafeImportedMarkdownThemeId } from '@/lib/markdown/theme-compatibility/types';

export type MarkdownSettings = UnifiedData['settings']['markdown'];
export type CodeBlockMarkdownSettings = MarkdownSettings['codeBlock'];
export type ResolvedMarkdownSettings = MarkdownSettings & {
  theme: MarkdownThemeSettings;
  body: {
    showLineNumbers: boolean;
  };
  codeBlock: {
    showLineNumbers: boolean;
  };
};

let cachedMarkdownSettingsSource: MarkdownSettings | undefined;
let cachedResolvedMarkdownSettings: ResolvedMarkdownSettings | undefined;

export function resolveMarkdownThemeSettings(
  settings?: Partial<MarkdownThemeSettings> | null
): MarkdownThemeSettings {
  const importedThemeId = typeof settings?.importedThemeId === 'string'
    ? settings.importedThemeId.trim()
    : null;
  return {
    importedThemeId: importedThemeId && isSafeImportedMarkdownThemeId(importedThemeId)
      ? importedThemeId
      : null,
  };
}

export function createDefaultMarkdownSettings(): ResolvedMarkdownSettings {
  return {
    ...DEFAULT_SETTINGS.markdown,
    theme: {
      ...DEFAULT_SETTINGS.markdown.theme,
    },
    body: {
      ...DEFAULT_SETTINGS.markdown.body,
    },
    codeBlock: {
      ...DEFAULT_SETTINGS.markdown.codeBlock,
    },
  };
}

export function resolveMarkdownSettings(
  settings?: Partial<MarkdownSettings> | null
): ResolvedMarkdownSettings {
  const defaults = createDefaultMarkdownSettings();

  return {
    ...defaults,
    ...settings,
    theme: resolveMarkdownThemeSettings(settings?.theme),
    body: {
      ...defaults.body,
      ...settings?.body,
    },
    codeBlock: {
      ...defaults.codeBlock,
      ...settings?.codeBlock,
    },
  };
}

export function selectMarkdownSettings(state: { data: UnifiedData }): ResolvedMarkdownSettings {
  const source = state.data.settings.markdown;
  if (cachedMarkdownSettingsSource !== source || !cachedResolvedMarkdownSettings) {
    cachedMarkdownSettingsSource = source;
    cachedResolvedMarkdownSettings = resolveMarkdownSettings(source);
  }
  return cachedResolvedMarkdownSettings;
}

export function selectCodeBlockLineNumbersEnabled(state: { data: UnifiedData }): boolean {
  return selectMarkdownSettings(state).codeBlock.showLineNumbers;
}

export function selectMarkdownTypewriterModeEnabled(state: { data: UnifiedData }): boolean {
  return selectMarkdownSettings(state).typewriterMode;
}

export function selectMarkdownThemeSettings(state: { data: UnifiedData }): MarkdownThemeSettings {
  return selectMarkdownSettings(state).theme;
}

export function selectMarkdownImportedThemeId(state: { data: UnifiedData }): string | null {
  return selectMarkdownThemeSettings(state).importedThemeId ?? null;
}

export function selectMarkdownBodyLineNumbersEnabled(state: { data: UnifiedData }): boolean {
  return selectMarkdownSettings(state).body.showLineNumbers;
}

export function updateMarkdownCodeBlockLineNumbers(
  data: UnifiedData,
  showLineNumbers: boolean
): UnifiedData {
  const markdown = resolveMarkdownSettings(data.settings.markdown);

  return {
    ...data,
    settings: {
      ...data.settings,
      markdown: {
        ...markdown,
        codeBlock: {
          ...markdown.codeBlock,
          showLineNumbers,
        },
      },
    },
  };
}

export function updateMarkdownBodyLineNumbers(
  data: UnifiedData,
  showLineNumbers: boolean
): UnifiedData {
  const markdown = resolveMarkdownSettings(data.settings.markdown);

  return {
    ...data,
    settings: {
      ...data.settings,
      markdown: {
        ...markdown,
        body: {
          ...markdown.body,
          showLineNumbers,
        },
      },
    },
  };
}

export function updateMarkdownTypewriterMode(
  data: UnifiedData,
  typewriterMode: boolean
): UnifiedData {
  const markdown = resolveMarkdownSettings(data.settings.markdown);

  return {
    ...data,
    settings: {
      ...data.settings,
      markdown: {
        ...markdown,
        typewriterMode,
      },
    },
  };
}

export function updateMarkdownImportedThemeId(
  data: UnifiedData,
  importedThemeId: string | null
): UnifiedData {
  const markdown = resolveMarkdownSettings(data.settings.markdown);
  const normalizedThemeId = typeof importedThemeId === 'string' && importedThemeId.trim()
    && isSafeImportedMarkdownThemeId(importedThemeId.trim())
    ? importedThemeId.trim()
    : null;

  return {
    ...data,
    settings: {
      ...data.settings,
      markdown: {
        ...markdown,
        theme: {
          ...markdown.theme,
          importedThemeId: normalizedThemeId,
        },
      },
    },
  };
}
