/**
 * UI State Store - 统一 UI 状态管理
 * 
 * 这个模块是所有 UI 状态的唯一真相来源。
 * 包含：drawer、search、filters、drag state、archive view、calendar UI state
 * 
 * 设计原则：
 * 1. 单一真相来源 - 所有 UI 状态集中在这里
 * 2. 与数据分离 - UnifiedStore 只管数据，UIStore 只管 UI
 * 3. 向后兼容 - useCalendarStore 透明委托到这里
 */

import { create } from 'zustand';
import { ALL_COLORS, type ItemColor } from '@/lib/colors';
import { type TimeView } from '@/lib/date';
import { STORAGE_KEY_COLOR_FILTER, STORAGE_KEY_STATUS_FILTER } from '@/lib/config';

export type TaskStatus = 'todo' | 'scheduled' | 'completed';
export const ALL_STATUSES: TaskStatus[] = ['todo', 'scheduled', 'completed'];

// App view mode - calendar or notes
export type AppViewMode = 'calendar' | 'notes';

interface UIStore {
  // App view mode
  appViewMode: AppViewMode;
  setAppViewMode: (mode: AppViewMode) => void;
  toggleAppViewMode: () => void;

  // Drawer state
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;

  // Display settings
  hideCompleted: boolean;
  hideActualTime: boolean;
  setHideCompleted: (hide: boolean) => void;
  setHideActualTime: (hide: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Color filter
  selectedColors: ItemColor[];
  setSelectedColors: (colors: ItemColor[]) => void;
  toggleColor: (color: ItemColor) => void;
  toggleAllColors: () => void;

  // Status filter
  selectedStatuses: TaskStatus[];
  setSelectedStatuses: (statuses: TaskStatus[]) => void;
  toggleStatus: (status: TaskStatus) => void;
  toggleAllStatuses: () => void;
  
  // Archive time view settings
  archiveTimeView: TimeView;
  archiveDayRange: number | 'all';
  archiveWeekRange: number | 'all';
  archiveMonthRange: number | 'all';
  setArchiveTimeView: (view: TimeView) => void;
  setArchiveRange: (view: TimeView, range: number | 'all') => void;
  getArchiveMaxDays: () => number | null;
  
  // Drag state
  draggingTaskId: string | null;
  setDraggingTaskId: (id: string | null) => void;
  
  // 正在拖动到日历区域的任务ID（用于临时隐藏日历上的事件）
  draggingToCalendarTaskId: string | null;
  setDraggingToCalendarTaskId: (id: string | null) => void;
  
  // ============ Calendar UI State (从 UnifiedStore 迁移) ============
  
  // Sidebar visibility
  showSidebar: boolean;
  toggleSidebar: () => void;
  
  // Context panel visibility
  showContextPanel: boolean;
  toggleContextPanel: () => void;
  
  // Selected date for calendar view
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  
  // Event editing state
  editingEventId: string | null;
  editingEventPosition: { x: number; y: number } | null;
  setEditingEventId: (id: string | null, position?: { x: number; y: number }) => void;
  closeEditingEvent: () => void;
  
  // Event selection state
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  
  // Icon preview state (for hover preview on calendar)
  previewIconEventId: string | null;
  previewIcon: string | undefined | null;
  setPreviewIcon: (eventId: string | null, icon: string | undefined | null) => void;
  
  // Color preview state (for hover preview on calendar)
  previewColorEventId: string | null;
  previewColor: ItemColor | null;
  setPreviewColor: (eventId: string | null, color: ItemColor | null) => void;
}

function loadColorFilter(): ItemColor[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COLOR_FILTER);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return [...ALL_COLORS];
}

function saveColorFilter(colors: ItemColor[]): void {
  localStorage.setItem(STORAGE_KEY_COLOR_FILTER, JSON.stringify(colors));
}

function loadStatusFilter(): TaskStatus[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STATUS_FILTER);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return ALL_STATUSES;
}

function saveStatusFilter(statuses: TaskStatus[]): void {
  localStorage.setItem(STORAGE_KEY_STATUS_FILTER, JSON.stringify(statuses));
}

export const useUIStore = create<UIStore>()((set, get) => ({
  // App view mode
  appViewMode: 'calendar' as AppViewMode,
  setAppViewMode: (mode) => set({ appViewMode: mode }),
  toggleAppViewMode: () => set((state) => ({ 
    appViewMode: state.appViewMode === 'calendar' ? 'notes' : 'calendar' 
  })),

  // Drawer state
  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  
  // Display settings
  hideCompleted: false,
  hideActualTime: false,
  setHideCompleted: (hide) => set({ hideCompleted: hide }),
  setHideActualTime: (hide) => set({ hideActualTime: hide }),
  
  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Color filter (initialized from localStorage)
  selectedColors: loadColorFilter(),

  setSelectedColors: (colors) => {
    set({ selectedColors: colors });
    saveColorFilter(colors);
  },

  toggleColor: (color) => {
    set((state) => {
      const newColors = state.selectedColors.includes(color)
        ? state.selectedColors.filter(c => c !== color)
        : [...state.selectedColors, color];

      saveColorFilter(newColors);
      return { selectedColors: newColors };
    });
  },

  toggleAllColors: () => {
    set((state) => {
      const newColors = state.selectedColors.length === ALL_COLORS.length ? [] : [...ALL_COLORS];
      saveColorFilter(newColors);
      return { selectedColors: newColors };
    });
  },

  // Status filter (initialized from localStorage)
  selectedStatuses: loadStatusFilter(),

  setSelectedStatuses: (statuses) => {
    set({ selectedStatuses: statuses });
    saveStatusFilter(statuses);
  },

  toggleStatus: (status) => {
    set((state) => {
      const newStatuses = state.selectedStatuses.includes(status)
        ? state.selectedStatuses.filter(s => s !== status)
        : [...state.selectedStatuses, status];

      saveStatusFilter(newStatuses);
      return { selectedStatuses: newStatuses };
    });
  },

  toggleAllStatuses: () => {
    set((state) => {
      const newStatuses = state.selectedStatuses.length === ALL_STATUSES.length ? [] : ALL_STATUSES;
      saveStatusFilter(newStatuses);
      return { selectedStatuses: newStatuses };
    });
  },
  
  // Archive time view settings
  archiveTimeView: 'day',
  archiveDayRange: 7,
  archiveWeekRange: 4,
  archiveMonthRange: 3,
  
  setArchiveTimeView: (view) => set({ archiveTimeView: view }),
  
  setArchiveRange: (view, range) => {
    if (view === 'day') set({ archiveDayRange: range });
    else if (view === 'week') set({ archiveWeekRange: range });
    else set({ archiveMonthRange: range });
  },
  
  getArchiveMaxDays: (): number | null => {
    const state = get();
    const { archiveTimeView, archiveDayRange, archiveWeekRange, archiveMonthRange } = state;
    
    if (archiveTimeView === 'day') {
      return archiveDayRange === 'all' ? null : archiveDayRange as number;
    } else if (archiveTimeView === 'week') {
      return archiveWeekRange === 'all' ? null : (archiveWeekRange as number) * 7;
    } else {
      return archiveMonthRange === 'all' ? null : (archiveMonthRange as number) * 30;
    }
  },
  
  // Drag state
  draggingTaskId: null,
  setDraggingTaskId: (id) => set({ draggingTaskId: id }),
  
  // 正在拖动到日历区域的任务ID
  draggingToCalendarTaskId: null,
  setDraggingToCalendarTaskId: (id) => set({ draggingToCalendarTaskId: id }),
  
  // ============ Calendar UI State ============
  
  // Sidebar visibility
  showSidebar: true,
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  
  // Context panel visibility
  showContextPanel: true,
  toggleContextPanel: () => set((state) => ({ showContextPanel: !state.showContextPanel })),
  
  // Selected date for calendar view
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  
  // Event editing state
  editingEventId: null,
  editingEventPosition: null,
  setEditingEventId: (id, position) => set({ 
    editingEventId: id, 
    editingEventPosition: position || null 
  }),
  closeEditingEvent: () => set({ 
    editingEventId: null, 
    editingEventPosition: null 
  }),
  
  // Event selection state
  selectedEventId: null,
  setSelectedEventId: (id) => set({ selectedEventId: id }),
  
  // Icon preview state (for hover preview on calendar)
  previewIconEventId: null,
  previewIcon: null,
  setPreviewIcon: (eventId, icon) => set({ 
    previewIconEventId: eventId, 
    previewIcon: icon 
  }),
  
  // Color preview state (for hover preview on calendar)
  previewColorEventId: null,
  previewColor: null,
  setPreviewColor: (eventId, color) => set({ 
    previewColorEventId: eventId, 
    previewColor: color 
  }),
}));
