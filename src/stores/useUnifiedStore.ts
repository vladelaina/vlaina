// Unified Store - LEGACY / PARTIAL
// Kept for Settings, Progress and Custom Icons.
// Task/Group/Calendar logic has moved to CalendarEventsStore (ICS).

import { create } from 'zustand';
import {
  loadUnifiedData,
  saveUnifiedData,
  type UnifiedData,
  type UnifiedTask,
  type UnifiedGroup,
  type UnifiedProgress,
  type UnifiedArchiveSection,
  type CustomIcon,
} from '@/lib/storage/unifiedStorage';
import { scanGlobalIcons } from '@/lib/storage/assetStorage';

import { createProgressActions } from './actions/progressActions';
import { createSettingsActions } from './actions/settingsActions';
import type { TimeView } from '@/lib/date';
import type { ItemColor } from '@/lib/colors';
import { 
  DEFAULT_GROUP_ID,
  DEFAULT_GROUP_NAME,
  DEFAULT_SETTINGS,
} from '@/lib/config';
import type { UndoAction } from './types';

export type {
  UnifiedTask,
  UnifiedGroup,
  UnifiedProgress,
  UnifiedArchiveSection,
  CustomIcon,
};

export type { ItemColor, TimeView };

interface UnifiedStoreState {
  data: UnifiedData;
  loaded: boolean;
  activeGroupId: string;
  undoStack: UndoAction[];
}

interface UnifiedStoreActions {
  load: () => Promise<void>;
  setActiveGroup: (id: string) => void;
  
  // Progress Actions
  addProgress: (item: Omit<UnifiedProgress, 'id' | 'createdAt' | 'current' | 'todayCount'>) => void;
  updateProgress: (id: string, delta: number) => void;
  updateProgressItem: (id: string, updates: Partial<UnifiedProgress>) => void;
  deleteProgress: (id: string) => void;
  toggleProgressArchive: (id: string) => void;
  reorderProgress: (activeId: string, overId: string) => void;

  // Settings Actions
  setTimezone: (tz: number) => void;
  setViewMode: (mode: TimeView) => void;
  setDayCount: (count: number) => void;
  setHourHeight: (height: number) => void;
  toggle24Hour: () => void;
  setDayStartTime: (minutes: number) => void;
  
  // Custom Icon Actions
  addCustomIcon: (icon: CustomIcon) => void;
  removeCustomIcon: (id: string) => void;
  syncCustomIcons: () => Promise<void>;
}

type UnifiedStore = UnifiedStoreState & UnifiedStoreActions;

function persist(data: UnifiedData) {
  saveUnifiedData(data);
}

const initialState: UnifiedStoreState = {
  data: {
    groups: [{ id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME, pinned: false, createdAt: Date.now() }],
    tasks: [],
    progress: [],
    archive: [],
    settings: { ...DEFAULT_SETTINGS },
    customIcons: [],
  },
  loaded: false,
  activeGroupId: DEFAULT_GROUP_ID,
  undoStack: [],
};

export const useUnifiedStore = create<UnifiedStore>((set, get) => {
  const progressActions = createProgressActions(set as any, persist);
  const settingsActions = createSettingsActions(set as any, persist);

  return {
    ...initialState,

    load: async () => {
      if (get().loaded) return;
      const data = await loadUnifiedData();
      set({ data, loaded: true });
    },

    setActiveGroup: (id: string) => set({ activeGroupId: id }),

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
        
        // Find new icons
        const newIcons = scanned.filter(i => !existingIds.has(i.id));
        
        // Optional: Filter out icons that no longer exist?
        // For now, let's just ADD missing ones to avoid accidental data loss if scan fails
        
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

    ...progressActions,
    ...settingsActions,
  };
});

export { useUnifiedStore as useStore };
