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
        const timezone = {
          offset: Math.max(-12, Math.min(14, offset)),
          city,
        };
        if (
          state.data.settings.timezone?.offset === timezone.offset &&
          state.data.settings.timezone?.city === timezone.city
        ) {
          return {};
        }

        const newData = {
          ...state.data,
          settings: {
            ...state.data.settings,
            timezone,
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

    setLastAppViewMode: (mode: 'notes' | 'chat', skipPersist = false) => {
      set((state) => {
        if (state.data.settings.ui?.lastAppViewMode === mode) {
          return {};
        }

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
        if (!skipPersist) {
          persist(newData, {
            settings: {
              ui: {
                lastAppViewMode: mode,
              },
            },
          });
        }
        return { data: newData };
      });
    },

    setColorMode: (mode: NonNullable<UnifiedData['settings']['ui']>['colorMode']) => {
      const colorMode: NonNullable<UnifiedData['settings']['ui']>['colorMode'] =
        mode === 'light' || mode === 'dark' ? mode : 'system';
      set((state) => {
        if (state.data.settings.ui?.colorMode === colorMode) {
          return {};
        }

        const newData = {
          ...state.data,
          settings: {
            ...state.data.settings,
            ui: {
              ...state.data.settings.ui,
              colorMode,
            },
          },
        };
        persist(newData, {
          settings: {
            ui: {
              colorMode,
            },
          },
        });
        return { data: newData };
      });
    },

    setThemeId: (themeId: string) => {
      const normalizedThemeId = themeId.trim() || 'default';
      set((state) => {
        if (state.data.settings.ui?.themeId === normalizedThemeId) {
          return {};
        }

        const newData = {
          ...state.data,
          settings: {
            ...state.data.settings,
            ui: {
              ...state.data.settings.ui,
              themeId: normalizedThemeId,
            },
          },
        };
        persist(newData, {
          settings: {
            ui: {
              themeId: normalizedThemeId,
            },
          },
        });
        return { data: newData };
      });
    },

    setNotesChatFloatingSize: (size: NonNullable<UnifiedData['settings']['ui']>['notesChatFloatingSize']) => {
      if (!size) {
        return;
      }

      set((state) => {
        const current = state.data.settings.ui?.notesChatFloatingSize;
        if (current?.width === size.width && current?.height === size.height) {
          return {};
        }

        const newData = {
          ...state.data,
          settings: {
            ...state.data.settings,
            ui: {
              ...state.data.settings.ui,
              notesChatFloatingSize: size,
            },
          },
        };
        persist(newData, {
          settings: {
            ui: {
              notesChatFloatingSize: size,
            },
          },
        });
        return { data: newData };
      });
    },

    ...createMarkdownSettingsActions(set, persist),
  };
}
