import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import { createMarkdownSettingsActions } from './markdownSettingsActions';

type SetState = (fn: (state: { 
  data: UnifiedData; 
}) => Partial<{ 
  data: UnifiedData; 
}>) => void;

type Persist = (data: UnifiedData) => void;

export function createSettingsActions(set: SetState, persist: Persist) {
  return {
    setTimezone: (offset: number, city: string) => {
      set((state) => {
        const newData = {
          ...state.data,
          settings: { 
            ...state.data.settings, 
            timezone: { 
              offset: Math.max(-12, Math.min(14, offset)),
              city,
            } 
          },
        };
        persist(newData);
        return { data: newData };
      });
    },

    ...createMarkdownSettingsActions(set, persist),
  };
}
