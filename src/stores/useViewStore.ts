import { create } from 'zustand';

type ViewType = 'time-tracker' | 'progress' | 'calendar';

interface ViewStore {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  currentView: 'calendar',
  setView: (view) => set({ currentView: view }),
}));
