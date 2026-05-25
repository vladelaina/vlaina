import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import type { UnifiedSavePatch } from '@/lib/storage/unifiedStorage';
import { createMarkdownSettingsActions } from './markdownSettingsActions';

type SetState = (fn: (state: { 
  data: UnifiedData; 
}) => Partial<{ 
  data: UnifiedData; 
}>) => void;

type Persist = (data: UnifiedData, patch?: UnifiedSavePatch) => void;

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
        persist(newData, {
          settings: {
            timezone: newData.settings.timezone,
          },
        });
        return { data: newData };
      });
    },

    setLastAppViewMode: (mode: 'notes' | 'chat') => {
      set((state) => {
        const newData = {
          ...state.data,
          settings: {
            ...state.data.settings,
            ui: {
              ...state.data.settings.ui,
              lastAppViewMode: mode,
            },
          },
        };
        persist(newData, {
          settings: {
            ui: {
              lastAppViewMode: mode,
            },
          },
        });
        return { data: newData };
      });
    },

    ...createMarkdownSettingsActions(set, persist),
  };
}
