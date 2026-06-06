import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import type { UnifiedSavePatch } from '@/lib/storage/unifiedStorage';
import {
  updateMarkdownBodyLineNumbers,
  updateMarkdownCodeBlockLineNumbers,
  updateMarkdownImportedThemeId,
  updateMarkdownTypewriterMode,
} from '../settings/markdownSettings';

type SetState = (fn: (state: {
  data: UnifiedData;
}) => Partial<{
  data: UnifiedData;
}>) => void;

type Persist = (data: UnifiedData, patch?: UnifiedSavePatch) => void;

export function createMarkdownSettingsActions(set: SetState, persist: Persist) {
  return {
    setMarkdownCodeBlockLineNumbers: (showLineNumbers: boolean) => {
      set((state) => {
        const newData = updateMarkdownCodeBlockLineNumbers(state.data, showLineNumbers);
        persist(newData, {
          settings: {
            markdown: {
              codeBlock: {
                showLineNumbers,
              },
            },
          },
        });
        return { data: newData };
      });
    },
    setMarkdownBodyLineNumbers: (showLineNumbers: boolean) => {
      set((state) => {
        const newData = updateMarkdownBodyLineNumbers(state.data, showLineNumbers);
        persist(newData, {
          settings: {
            markdown: {
              body: {
                showLineNumbers,
              },
            },
          },
        });
        return { data: newData };
      });
    },
    setMarkdownTypewriterMode: (typewriterMode: boolean) => {
      set((state) => {
        const newData = updateMarkdownTypewriterMode(state.data, typewriterMode);
        persist(newData, {
          settings: {
            markdown: {
              typewriterMode,
            },
          },
        });
        return { data: newData };
      });
    },
    setMarkdownImportedThemeId: (importedThemeId: string | null) => {
      set((state) => {
        const normalizedThemeId = typeof importedThemeId === 'string' && importedThemeId.trim()
          ? importedThemeId.trim()
          : null;
        const newData = updateMarkdownImportedThemeId(state.data, normalizedThemeId);
        const nextTheme = newData.settings.markdown.theme;
        persist(newData, {
          settings: {
            markdown: {
              theme: {
                importedThemeId: nextTheme?.importedThemeId ?? null,
              },
            },
          },
        });
        return { data: newData };
      });
    },
  };
}
