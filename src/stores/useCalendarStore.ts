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
  showContextPanel: boolean; // Whether to show the right sidebar
  
  // Actions
  load: () => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => void;
  deleteEvent: (id: string) => void;
  
  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: Date) => void;
  setDayCount: (count: number) => void;
  toggleContextPanel: () => void;
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: [],
  loaded: false,
  viewMode: 'week', // Default to week view (efficient)
  selectedDate: new Date(),
  dayCount: 1, // Default to single day
  showContextPanel: true, // Default to showing the right sidebar

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
    set({ events: newEvents });
    saveEvents(newEvents); // Auto-persist
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDayCount: (count) => set({ dayCount: Math.max(1, Math.min(14, count)) }),
  toggleContextPanel: () => set((state) => ({ showContextPanel: !state.showContextPanel })),
}));
