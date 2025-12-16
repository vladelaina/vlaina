import { create } from 'zustand';

export type ViewType = 'tasks' | 'time-tracker' | 'progress' | 'calendar';

interface ViewStore {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  currentView: 'tasks',
  setView: (view) => set({ currentView: view }),
}));
