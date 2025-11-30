import { create } from 'zustand';
import { nanoid } from 'nanoid';

export interface ProgressItem {
  id: string;
  type: 'progress';
  title: string;
  note?: string;
  direction: 'increment' | 'decrement';
  total: number;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  startDate?: number;
  endDate?: number;
  createdAt: number;
}

export interface CounterItem {
  id: string;
  type: 'counter';
  title: string;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  createdAt: number;
}

export type ProgressOrCounter = ProgressItem | CounterItem;

interface ProgressStore {
  items: ProgressOrCounter[];
  
  addProgress: (data: Omit<ProgressItem, 'id' | 'type' | 'current' | 'todayCount' | 'createdAt'>) => void;
  addCounter: (data: { title: string; step: number; unit: string; frequency: 'daily' | 'weekly' | 'monthly' }) => void;
  updateCurrent: (id: string, delta: number) => void;
  deleteItem: (id: string) => void;
  updateItem: (id: string, data: Partial<ProgressOrCounter>) => void;
}

export const useProgressStore = create<ProgressStore>((set) => ({
  items: [],
  
  addProgress: (data) => set((state) => {
    const newItem: ProgressItem = {
      id: nanoid(),
      type: 'progress',
      title: data.title,
      note: data.note,
      direction: data.direction,
      total: data.total,
      step: data.step,
      unit: data.unit,
      current: data.direction === 'increment' ? 0 : data.total,
      todayCount: 0,
      lastUpdateDate: undefined,
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: Date.now(),
    };
    return { items: [...state.items, newItem] };
  }),
  
  addCounter: (data) => set((state) => {
    const newItem: CounterItem = {
      id: nanoid(),
      type: 'counter',
      title: data.title,
      step: data.step,
      unit: data.unit,
      current: 0,
      todayCount: 0,
      lastUpdateDate: undefined,
      frequency: data.frequency,
      createdAt: Date.now(),
    };
    return { items: [...state.items, newItem] };
  }),
  
  updateCurrent: (id, delta) => set((state) => {
    const today = new Date().toDateString();
    const newItems = state.items.map((item): ProgressOrCounter => {
      if (item.id !== id) return item;
      
      const isNewDay = item.lastUpdateDate !== today;
      const newTodayCount = isNewDay ? Math.abs(delta) : item.todayCount + Math.abs(delta);
      
      if (item.type === 'progress') {
        const newCurrent = Math.max(0, Math.min(item.total, item.current + delta));
        return { ...item, current: newCurrent, todayCount: newTodayCount, lastUpdateDate: today };
      } else {
        return { ...item, current: item.current + delta, todayCount: newTodayCount, lastUpdateDate: today };
      }
    });
    return { items: newItems };
  }),
  
  deleteItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id),
  })),
  
  updateItem: (id, data) => set((state) => {
    const newItems = state.items.map((item): ProgressOrCounter => {
      if (item.id !== id) return item;
      return { ...item, ...data } as ProgressOrCounter;
    });
    return { items: newItems };
  }),
}));
