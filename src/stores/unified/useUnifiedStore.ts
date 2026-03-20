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
import { isTemporarySession, isTemporarySessionId } from '@/lib/ai/temporaryChat';

import { createProgressActions } from './actions/progressActions';
import { createSettingsActions } from './actions/settingsActions';
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
  reloadFromDisk: (options?: { preserveRuntimeChat?: boolean }) => Promise<void>;
  
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
  
  addCustomIcon: (icon: CustomIcon) => void;
  removeCustomIcon: (id: string) => void;
  syncCustomIcons: () => Promise<void>;

  updateAIData: (updates: Partial<NonNullable<UnifiedData['ai']>>, skipPersist?: boolean) => void;
}

type UnifiedStore = UnifiedStoreState & UnifiedStoreActions;

function persist(data: UnifiedData) {
  saveUnifiedData(data);
}

function createDefaultAIData(): NonNullable<UnifiedData['ai']> {
  return {
    providers: [],
    models: [],
    benchmarkResults: {},
    fetchedModels: {},
    sessions: [],
    messages: {},
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

  normalized.ai = ai
    ? {
        ...createDefaultAIData(),
        ...ai,
        benchmarkResults: ai.benchmarkResults || {},
        fetchedModels: ai.fetchedModels || {},
        customSystemPrompt: ai.customSystemPrompt || '',
        includeTimeContext: ai.includeTimeContext !== false,
        temporaryChatEnabled: false,
      }
    : createDefaultAIData();

  return normalized;
}

function mergeRuntimeChatState(nextData: UnifiedData, previousData: UnifiedData): UnifiedData {
  const nextAI = nextData.ai;
  const prevAI = previousData.ai;

  if (!nextAI || !prevAI) {
    return nextData;
  }

  const mergedAI = { ...nextAI };
  const existingSessionIds = new Set(mergedAI.sessions.map((session) => session.id));
  const preservedMessages: NonNullable<UnifiedData['ai']>['messages'] = {};

  for (const [sessionId, messages] of Object.entries(prevAI.messages || {})) {
    if (existingSessionIds.has(sessionId) || isTemporarySessionId(sessionId)) {
      preservedMessages[sessionId] = messages;
    }
  }
  mergedAI.messages = { ...mergedAI.messages, ...preservedMessages };

  if (prevAI.temporaryChatEnabled) {
    const temporarySessions = prevAI.sessions.filter((session) => isTemporarySession(session));
    if (temporarySessions.length > 0) {
      const nonDuplicateTemps = temporarySessions.filter(
        (session) => !existingSessionIds.has(session.id)
      );
      if (nonDuplicateTemps.length > 0) {
        mergedAI.sessions = [...nonDuplicateTemps, ...mergedAI.sessions];
      }
      mergedAI.temporaryChatEnabled = true;
    }
  }

  if (prevAI.currentSessionId) {
    const hasCurrentSession =
      mergedAI.sessions.some((session) => session.id === prevAI.currentSessionId) ||
      !!mergedAI.messages[prevAI.currentSessionId];
    if (hasCurrentSession) {
      mergedAI.currentSessionId = prevAI.currentSessionId;
    }
  }

  if (prevAI.selectedModelId && mergedAI.models.some((model) => model.id === prevAI.selectedModelId)) {
    mergedAI.selectedModelId = prevAI.selectedModelId;
  }

  return { ...nextData, ai: mergedAI };
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

    reloadFromDisk: async (options) => {
      const previousData = get().data;
      const normalizedData = normalizeUnifiedData(await loadUnifiedData());
      const data = options?.preserveRuntimeChat
        ? mergeRuntimeChatState(normalizedData, previousData)
        : normalizedData;
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
