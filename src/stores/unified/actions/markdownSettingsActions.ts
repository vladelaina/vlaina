import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import type { UnifiedSavePatch } from '@/lib/storage/unifiedStorage';
import {
  resolveMarkdownSettings,
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
        const markdown = resolveMarkdownSettings(state.data.settings.markdown);
        if (markdown.codeBlock.showLineNumbers === showLineNumbers) {
          return {};
        }

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
        const markdown = resolveMarkdownSettings(state.data.settings.markdown);
        if (markdown.body.showLineNumbers === showLineNumbers) {
          return {};
        }

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
        const markdown = resolveMarkdownSettings(state.data.settings.markdown);
        if (markdown.typewriterMode === typewriterMode) {
          return {};
        }

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
        const newData = updateMarkdownImportedThemeId(state.data, importedThemeId);
        const markdown = resolveMarkdownSettings(state.data.settings.markdown);
        const nextTheme = newData.settings.markdown.theme;
        if ((markdown.theme.importedThemeId ?? null) === (nextTheme?.importedThemeId ?? null)) {
          return {};
        }

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
