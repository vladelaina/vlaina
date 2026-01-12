/** UI State Store - Unified UI state management */

import { create } from 'zustand';
import { ALL_COLORS, type ItemColor } from '@/lib/colors';
import { type TimeView } from '@/lib/date';
import { STORAGE_KEY_COLOR_FILTER, STORAGE_KEY_STATUS_FILTER } from '@/lib/config';

export type TaskStatus = 'todo' | 'scheduled' | 'completed';
export const ALL_STATUSES: TaskStatus[] = ['todo', 'scheduled', 'completed'];

export type AppViewMode = 'calendar' | 'notes';

interface UIStore {
  appViewMode: AppViewMode;
  setAppViewMode: (mode: AppViewMode) => void;
  toggleAppViewMode: () => void;

  notesSidebarCollapsed: boolean;
  notesSidebarWidth: number;
  toggleNotesSidebar: () => void;
  setNotesSidebarWidth: (width: number) => void;
  sidebarHeaderHovered: boolean;
  setSidebarHeaderHovered: (hovered: boolean) => void;

  notesPreviewIcon: { path: string; icon: string } | null;
  setNotesPreviewIcon: (path: string | null, icon: string | null) => void;

  notesPreviewIconColor: string | null;
  setNotesPreviewIconColor: (color: string | null) => void;

  notesPreviewSkinTone: number | null;
  setNotesPreviewSkinTone: (tone: number | null) => void;

  notesPreviewTitle: { path: string; title: string } | null;
  setNotesPreviewTitle: (path: string | null, title: string | null) => void;

  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;

  hideCompleted: boolean;
  hideActualTime: boolean;
  setHideCompleted: (hide: boolean) => void;
  setHideActualTime: (hide: boolean) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  selectedColors: ItemColor[];
  setSelectedColors: (colors: ItemColor[]) => void;
  toggleColor: (color: ItemColor) => void;
  toggleAllColors: () => void;

  selectedStatuses: TaskStatus[];
  setSelectedStatuses: (statuses: TaskStatus[]) => void;
  toggleStatus: (status: TaskStatus) => void;
  toggleAllStatuses: () => void;

  archiveTimeView: TimeView;
  archiveDayRange: number | 'all';
  archiveWeekRange: number | 'all';
  archiveMonthRange: number | 'all';
  setArchiveTimeView: (view: TimeView) => void;
  setArchiveRange: (view: TimeView, range: number | 'all') => void;
  getArchiveMaxDays: () => number | null;

  draggingTaskId: string | null;
  setDraggingTaskId: (id: string | null) => void;

  draggingToCalendarTaskId: string | null;
  setDraggingToCalendarTaskId: (id: string | null) => void;

  showSidebar: boolean;
  toggleSidebar: () => void;

  showContextPanel: boolean;
  toggleContextPanel: () => void;

  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  editingEventId: string | null;
  editingEventPosition: { x: number; y: number } | null;
  setEditingEventId: (id: string | null, position?: { x: number; y: number }) => void;
  closeEditingEvent: () => void;

  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;

  previewIconEventId: string | null;
  previewIcon: string | undefined | null;
  setPreviewIcon: (eventId: string | null, icon: string | undefined | null) => void;

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
  }
  return ALL_STATUSES;
}

function saveStatusFilter(statuses: TaskStatus[]): void {
  localStorage.setItem(STORAGE_KEY_STATUS_FILTER, JSON.stringify(statuses));
}

export const useUIStore = create<UIStore>()((set, get) => ({
  appViewMode: 'notes' as AppViewMode,
  setAppViewMode: (mode) => set({ appViewMode: mode }),
  toggleAppViewMode: () => set((state) => ({
    appViewMode: state.appViewMode === 'calendar' ? 'notes' : 'calendar'
  })),

  notesSidebarCollapsed: false,
  notesSidebarWidth: 248,
  toggleNotesSidebar: () => set((state) => ({ notesSidebarCollapsed: !state.notesSidebarCollapsed })),
  setNotesSidebarWidth: (width) => set({ notesSidebarWidth: width }),
  sidebarHeaderHovered: false,
  setSidebarHeaderHovered: (hovered) => set({ sidebarHeaderHovered: hovered }),

  notesPreviewIcon: null,
  setNotesPreviewIcon: (path, icon) => {
    if (path && icon) {
      set({ notesPreviewIcon: { path, icon } });
    } else {
      set({ notesPreviewIcon: null });
    }
  },

  notesPreviewIconColor: null,
  setNotesPreviewIconColor: (color) => set({ notesPreviewIconColor: color }),

  notesPreviewSkinTone: null,
  setNotesPreviewSkinTone: (tone) => set({ notesPreviewSkinTone: tone }),

  notesPreviewTitle: null,
  setNotesPreviewTitle: (path, title) => {
    if (path && title) {
      set({ notesPreviewTitle: { path, title } });
    } else {
      set({ notesPreviewTitle: null });
    }
  },

  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

  hideCompleted: false,
  hideActualTime: false,
  setHideCompleted: (hide) => set({ hideCompleted: hide }),
  setHideActualTime: (hide) => set({ hideActualTime: hide }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

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

  draggingTaskId: null,
  setDraggingTaskId: (id) => set({ draggingTaskId: id }),

  draggingToCalendarTaskId: null,
  setDraggingToCalendarTaskId: (id) => set({ draggingToCalendarTaskId: id }),

  showSidebar: true,
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),

  showContextPanel: true,
  toggleContextPanel: () => set((state) => ({ showContextPanel: !state.showContextPanel })),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

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

  selectedEventId: null,
  setSelectedEventId: (id) => set({ selectedEventId: id }),

  previewIconEventId: null,
  previewIcon: null,
  setPreviewIcon: (eventId, icon) => set({
    previewIconEventId: eventId,
    previewIcon: icon
  }),

  previewColorEventId: null,
  previewColor: null,
  setPreviewColor: (eventId, color) => set({
    previewColorEventId: eventId,
    previewColor: color
  }),
}));
