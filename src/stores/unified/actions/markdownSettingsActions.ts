import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import { updateMarkdownCodeBlockLineNumbers } from '../settings/markdownSettings';

type SetState = (fn: (state: {
  data: UnifiedData;
}) => Partial<{
  data: UnifiedData;
}>) => void;

type Persist = (data: UnifiedData) => void;

export function createMarkdownSettingsActions(set: SetState, persist: Persist) {
  return {
    setMarkdownCodeBlockLineNumbers: (showLineNumbers: boolean) => {
      set((state) => {
        const newData = updateMarkdownCodeBlockLineNumbers(state.data, showLineNumbers);
        persist(newData);
        return { data: newData };
      });
    },
  };
}
