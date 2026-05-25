import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import type { UnifiedSavePatch } from '@/lib/storage/unifiedStorage';
import {
  updateMarkdownCodeBlockLineNumbers,
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
  };
}
