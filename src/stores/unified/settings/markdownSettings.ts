import { DEFAULT_SETTINGS } from '@/lib/config';
import type { UnifiedData } from '@/lib/storage/unifiedStorage';

export type MarkdownSettings = UnifiedData['settings']['markdown'];
export type CodeBlockMarkdownSettings = MarkdownSettings['codeBlock'];

export function createDefaultMarkdownSettings(): MarkdownSettings {
  return {
    ...DEFAULT_SETTINGS.markdown,
    codeBlock: {
      ...DEFAULT_SETTINGS.markdown.codeBlock,
    },
  };
}

export function resolveMarkdownSettings(
  settings?: Partial<MarkdownSettings> | null
): MarkdownSettings {
  const defaults = createDefaultMarkdownSettings();

  return {
    ...defaults,
    ...settings,
    codeBlock: {
      ...defaults.codeBlock,
      ...settings?.codeBlock,
    },
  };
}

export function selectMarkdownSettings(state: { data: UnifiedData }): MarkdownSettings {
  return resolveMarkdownSettings(state.data.settings.markdown);
}

export function selectCodeBlockLineNumbersEnabled(state: { data: UnifiedData }): boolean {
  return selectMarkdownSettings(state).codeBlock.showLineNumbers;
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
