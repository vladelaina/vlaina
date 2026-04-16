import { create } from 'zustand';
import {
  loadUnifiedData,
  saveUnifiedData,
  type UnifiedData,
  type UnifiedProgress,
  type CustomIcon,
  type TimezoneInfo,
} from '@/lib/storage/unifiedStorage';
import { scanGlobalIcons } from '@/lib/storage/assetStorage';

import { createProgressActions } from './actions/progressActions';
import { createSettingsActions } from './actions/settingsActions';
import { resolveMarkdownSettings } from './settings/markdownSettings';
import type { TimeView } from '@/lib/date';
import type { ItemColor } from '@/lib/colors';
import { 
  DEFAULT_SETTINGS,
} from '@/lib/config';
import type { UndoAction } from '../types';

export type {
  UnifiedProgress,
  CustomIcon,
  TimezoneInfo,
};

export type { ItemColor, TimeView };

interface UnifiedStoreState {
  data: UnifiedData;
  loaded: boolean;
  undoStack: UndoAction[];
}

interface UnifiedStoreActions {
  load: () => Promise<void>;
  reloadFromDisk: () => Promise<void>;
  
  addProgress: (item: Omit<UnifiedProgress, 'id' | 'createdAt' | 'current' | 'todayCount'>) => void;
  updateProgress: (id: string, delta: number) => void;
  updateProgressItem: (id: string, updates: Partial<UnifiedProgress>) => void;
  deleteProgress: (id: string) => void;
  toggleProgressArchive: (id: string) => void;
  reorderProgress: (activeId: string, overId: string) => void;

  setTimezone: (offset: number, city: string) => void;
  setViewMode: (mode: TimeView) => void;
  setDayCount: (count: number) => void;
  setHourHeight: (height: number) => void;
  toggle24Hour: () => void;
  setDayStartTime: (minutes: number) => void;
  setMarkdownCodeBlockLineNumbers: (showLineNumbers: boolean) => void;
  
  addCustomIcon: (icon: CustomIcon) => void;
  removeCustomIcon: (id: string) => void;
  syncCustomIcons: () => Promise<void>;

  updateAIData: (updates: Partial<NonNullable<UnifiedData['ai']>>, skipPersist?: boolean) => void;
}

type UnifiedStore = UnifiedStoreState & UnifiedStoreActions;

function persist(data: UnifiedData) {
  saveUnifiedData(data);
}

export function retainLoadedSessionMessages(
  previousData: UnifiedData,
  nextData: UnifiedData,
): UnifiedData {
  const previousMessages = previousData.ai?.messages;
  const nextAI = nextData.ai;

  if (!previousMessages || !nextAI) {
    return nextData;
  }

  const persistedSessionIds = new Set(nextAI.sessions.map((session) => session.id));
  const retainedMessages = Object.fromEntries(
    Object.entries(previousMessages).filter(([sessionId]) => persistedSessionIds.has(sessionId))
  );

  return {
    ...nextData,
    ai: {
      ...nextAI,
      messages: retainedMessages,
    },
  };
}

function createDefaultAIData(): NonNullable<UnifiedData['ai']> {
  return {
    providers: [],
    models: [],
    benchmarkResults: {},
    fetchedModels: {},
    sessions: [],
    messages: {},
    unreadSessionIds: [],
    selectedModelId: null,
    currentSessionId: null,
    temporaryChatEnabled: false,
    customSystemPrompt: '',
    includeTimeContext: true,
  };
}

function normalizeUnifiedData(data: UnifiedData): UnifiedData {
  const normalized: UnifiedData = { ...data };
  const ai = normalized.ai;
  const settings = normalized.settings;

  normalized.settings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    timezone: {
      ...DEFAULT_SETTINGS.timezone,
      ...settings?.timezone,
    },
    markdown: resolveMarkdownSettings(settings?.markdown),
  };

  normalized.ai = ai
    ? {
        ...createDefaultAIData(),
        ...ai,
        benchmarkResults: ai.benchmarkResults || {},
        fetchedModels: ai.fetchedModels || {},
        customSystemPrompt: ai.customSystemPrompt || '',
        includeTimeContext: ai.includeTimeContext !== false,
        unreadSessionIds: Array.isArray(ai.unreadSessionIds) ? ai.unreadSessionIds : [],
        temporaryChatEnabled: false,
      }
    : createDefaultAIData();

  return normalized;
}
const initialState: UnifiedStoreState = {
  data: {
    progress: [],
    settings: { ...DEFAULT_SETTINGS },
    customIcons: [],
    ai: createDefaultAIData(),
  },
  loaded: false,
  undoStack: [],
};

export const useUnifiedStore = create<UnifiedStore>((set, get) => {
  const progressActions = createProgressActions(set as any, persist);
  const settingsActions = createSettingsActions(set as any, persist);

  return {
    ...initialState,

    load: async () => {
      if (get().loaded) return;
      await get().reloadFromDisk();
    },

    reloadFromDisk: async () => {
      const previousData = get().data;
      const data = retainLoadedSessionMessages(
        previousData,
        normalizeUnifiedData(await loadUnifiedData())
      );
      set({ data, loaded: true });
    },

    addCustomIcon: (icon: CustomIcon) => {
      const state = get();
      const newData = {
        ...state.data,
        customIcons: [...(state.data.customIcons || []), icon]
      };
      set({ data: newData });
      persist(newData);
    },

    removeCustomIcon: (id: string) => {
      const state = get();
      const newData = {
        ...state.data,
        customIcons: (state.data.customIcons || []).filter(i => i.id !== id)
      };
      set({ data: newData });
      persist(newData);
    },

    syncCustomIcons: async () => {
      const scanned = await scanGlobalIcons();
      set(state => {
        const currentIcons = state.data.customIcons || [];
        const existingIds = new Set(currentIcons.map(i => i.id));
        
        const newIcons = scanned.filter(i => !existingIds.has(i.id));
        
        if (newIcons.length === 0) return {};
        
        const updatedIcons = [...currentIcons, ...newIcons];
        const newData = {
          ...state.data,
          customIcons: updatedIcons
        };
        
        persist(newData);
        return { data: newData };
      });
    },

    updateAIData: (updates, skipPersist = false) => {
        const state = get();
        const newData = {
            ...state.data,
            ai: {
                ...(state.data.ai || initialState.data.ai!),
                ...updates
            }
        };
        set({ data: newData });
        if (!skipPersist) {
            persist(newData);
        }
    },

    ...progressActions,
    ...settingsActions,
  };
});

export { useUnifiedStore as useStore };
