import { DEFAULT_SETTINGS } from '@/lib/config';
import type { UnifiedData } from '@/lib/storage/unifiedStorage';

export type MarkdownSettings = UnifiedData['settings']['markdown'];
export type CodeBlockMarkdownSettings = MarkdownSettings['codeBlock'];
export type ResolvedMarkdownSettings = MarkdownSettings & {
  body: {
    showLineNumbers: boolean;
  };
  codeBlock: {
    showLineNumbers: boolean;
  };
};

export function createDefaultMarkdownSettings(): ResolvedMarkdownSettings {
  return {
    ...DEFAULT_SETTINGS.markdown,
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
  return resolveMarkdownSettings(state.data.settings.markdown);
}

export function selectCodeBlockLineNumbersEnabled(state: { data: UnifiedData }): boolean {
  return selectMarkdownSettings(state).codeBlock.showLineNumbers;
}

export function selectMarkdownTypewriterModeEnabled(state: { data: UnifiedData }): boolean {
  return selectMarkdownSettings(state).typewriterMode;
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
