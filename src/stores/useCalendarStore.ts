import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { loadEvents, saveEvents, type CalendarEvent } from '@/lib/storage/calendarStorage';

// View mode types
export type ViewMode = 'day' | 'week' | 'month';

interface CalendarStore {
  // Data
  events: CalendarEvent[];
  loaded: boolean;
  
  // View State
  viewMode: ViewMode;
  selectedDate: Date; // Focus date
  dayCount: number; // Number of days to show in day view (1-14)
  showSidebar: boolean; // Whether to show the left sidebar
  showContextPanel: boolean; // Whether to show the right sidebar
  editingEventId: string | null; // Currently editing event ID
  timezone: number; // Timezone offset in hours (e.g., 8 for GMT+8, -5 for GMT-5)
  
  // Actions
  load: () => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => void;
  deleteEvent: (id: string) => void;
  
  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: Date) => void;
  setDayCount: (count: number) => void;
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  setEditingEventId: (id: string | null) => void;
  closeEditingEvent: () => void; // 关闭编辑并删除空标题事件
  setTimezone: (tz: number) => void;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  loaded: false,
  viewMode: 'week', // Default to week view (efficient)
  selectedDate: new Date(),
  dayCount: 1, // Default to single day
  showSidebar: true, // Default to showing the left sidebar
  showContextPanel: true, // Default to showing the right sidebar
  editingEventId: null, // No event being edited initially
  timezone: 8, // Default to GMT+8

  load: async () => {
    if (get().loaded) return;
    const events = await loadEvents();
    set({ events, loaded: true });
  },

  addEvent: (data) => {
    const newEvent: CalendarEvent = {
      id: nanoid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...data,
    };
    
    const newEvents = [...get().events, newEvent];
    set({ events: newEvents });
    saveEvents(newEvents); // Auto-persist
    return newEvent.id; // Return the new event ID
  },

  updateEvent: (id, updates) => {
    const newEvents = get().events.map(e => 
      e.id === id 
        ? { ...e, ...updates, updatedAt: Date.now() }
        : e
    );
    set({ events: newEvents });
    saveEvents(newEvents); // Auto-persist
  },

  deleteEvent: (id) => {
    const newEvents = get().events.filter(e => e.id !== id);
    set({ events: newEvents, editingEventId: get().editingEventId === id ? null : get().editingEventId });
    saveEvents(newEvents); // Auto-persist
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDayCount: (count) => set({ dayCount: Math.max(1, Math.min(14, count)) }),
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  toggleContextPanel: () => set((state) => ({ showContextPanel: !state.showContextPanel })),
  setEditingEventId: (id) => set({ editingEventId: id }),
  
  // 关闭编辑并删除空标题事件
  closeEditingEvent: () => {
    const { editingEventId, events } = get();
    if (editingEventId) {
      const event = events.find(e => e.id === editingEventId);
      if (event && !event.title.trim()) {
        // 删除空标题事件
        const newEvents = events.filter(e => e.id !== editingEventId);
        set({ events: newEvents, editingEventId: null });
        saveEvents(newEvents);
      } else {
        set({ editingEventId: null });
      }
    }
  },
  
  setTimezone: (tz) => set({ timezone: Math.max(-12, Math.min(14, tz)) }),
}));
