/**
 * Unified Store - Single Source of Truth for Data
 * 
 * Core concept: There is only one type of "item" (UnifiedTask)
 * - Items with startDate → displayed in calendar view
 * - Items without startDate → only displayed in todo list
 * - Scheduling a todo = adding startDate property
 * - Removing calendar event time = removing startDate property
 * 
 * Architecture:
 * - useUnifiedStore: 数据的单一真相来源（tasks, groups, progress, settings）
 * - useUIStore: UI 状态的单一真相来源（sidebar, editing, selection 等）
 * - useCalendarStore: Calendar view 数据访问层（委托到上述两个 store）
 * - useGroupStore: Todo view 数据访问层
 * - useProgressStore: Progress view 数据访问层
 */

import { create } from 'zustand';
import {
  loadUnifiedData,
  saveUnifiedData,
  type UnifiedData,
  type UnifiedTask,
  type UnifiedGroup,
  type UnifiedProgress,
  type UnifiedArchiveSection,
} from '@/lib/storage/unifiedStorage';

import { createGroupActions } from './actions/groupActions';
import { createTaskActions } from './actions/taskActions';
import { createCalendarActions } from './actions/calendarActions';
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

// Re-export types
export type {
  UnifiedTask,
  UnifiedGroup,
  UnifiedProgress,
  UnifiedArchiveSection,
};

export type { ItemColor, TimeView };

// Store state interface - 只包含数据状态，UI 状态已迁移到 UIStore
interface UnifiedStoreState {
  // Data
  data: UnifiedData;
  loaded: boolean;
  
  // Group selection (数据相关，保留在这里)
  activeGroupId: string;
  
  // Undo stack
  undoStack: UndoAction[];
}

// Store actions interface
interface UnifiedStoreActions {
  // Core
  load: () => Promise<void>;
  setActiveGroup: (id: string) => void;
  
  // Group Actions
  addGroup: (name: string) => void;
  updateGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  toggleGroupPin: (id: string) => void;
  reorderGroups: (activeId: string, overId: string) => void;
  
  // Task Actions
  addTask: (content: string, groupId: string, color?: ItemColor) => void;
  addSubTask: (parentId: string, content: string) => void;
  updateTask: (id: string, content: string) => void;
  updateTaskColor: (id: string, color: ItemColor) => void;
  updateTaskEstimation: (id: string, estimatedMinutes?: number) => void;
  updateTaskParent: (id: string, parentId: string | null, order: number) => void;
  toggleTask: (id: string) => void;
  toggleTaskCollapse: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteCompletedTasks: (groupId: string) => void;
  reorderTasks: (activeId: string, overId: string) => void;
  moveTaskToGroup: (taskId: string, targetGroupId: string, overTaskId?: string | null) => void;
  archiveCompletedTasks: (groupId: string) => void;
  
  // Calendar Data Actions (UI actions 已迁移到 UIStore)
  updateTaskTime: (id: string, startDate?: number | null, endDate?: number | null, isAllDay?: boolean) => void;
  addEvent: (event: { content: string; startDate: number; endDate: number; isAllDay: boolean; color?: string; groupId?: string }) => string;
  updateEvent: (id: string, updates: Partial<UnifiedTask>) => void;
  deleteEvent: (id: string) => void;
  undo: () => void;
  
  // Timer Actions
  startTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  stopTimer: (id: string) => void;
  
  // Progress Actions
  addProgress: (item: Omit<UnifiedProgress, 'id' | 'createdAt' | 'current' | 'todayCount'>) => void;
  updateProgress: (id: string, delta: number) => void;
  updateProgressItem: (id: string, updates: Partial<UnifiedProgress>) => void;
  deleteProgress: (id: string) => void;
  toggleProgressArchive: (id: string) => void;
  reorderProgress: (activeId: string, overId: string) => void;
  
  // Settings Actions (数据持久化设置)
  setTimezone: (tz: number) => void;
  setViewMode: (mode: TimeView) => void;
  setDayCount: (count: number) => void;
  setHourHeight: (height: number) => void;
  toggle24Hour: () => void;
  setDayStartTime: (minutes: number) => void;
}

type UnifiedStore = UnifiedStoreState & UnifiedStoreActions;

// Helper: Persist data
function persist(data: UnifiedData) {
  saveUnifiedData(data);
}

// Default initial state - 只包含数据状态
const initialState: UnifiedStoreState = {
  data: {
    groups: [{ id: DEFAULT_GROUP_ID, name: DEFAULT_GROUP_NAME, pinned: false, createdAt: Date.now() }],
    tasks: [],
    progress: [],
    archive: [],
    settings: { ...DEFAULT_SETTINGS },
  },
  loaded: false,
  activeGroupId: DEFAULT_GROUP_ID,
  undoStack: [],
};

export const useUnifiedStore = create<UnifiedStore>((set, get) => {
  // Create action creators
  const groupActions = createGroupActions(set as any, get as any, persist);
  const taskActions = createTaskActions(set as any, get as any, persist);
  const calendarActions = createCalendarActions(set as any, get as any, persist);
  const progressActions = createProgressActions(set as any, persist);
  const settingsActions = createSettingsActions(set as any, persist);

  return {
    // Initial state
    ...initialState,

    // Core actions
    load: async () => {
      if (get().loaded) return;
      const data = await loadUnifiedData();
      set({ data, loaded: true });
    },

    setActiveGroup: (id: string) => set({ activeGroupId: id }),

    // Spread all domain actions
    ...groupActions,
    ...taskActions,
    ...calendarActions,
    ...progressActions,
    ...settingsActions,
  };
});

// Re-export for convenience
export { useUnifiedStore as useStore };
