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
  startDate?: number;
  endDate?: number;
  createdAt: number;
}

export interface CounterItem {
  id: string;
  type: 'counter';
  title: string;
  step: number;
  current: number;
  createdAt: number;
}

export type ProgressOrCounter = ProgressItem | CounterItem;

interface ProgressStore {
  items: ProgressOrCounter[];
  
  addProgress: (data: Omit<ProgressItem, 'id' | 'type' | 'current' | 'createdAt'>) => void;
  addCounter: (title: string, step: number) => void;
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
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: Date.now(),
    };
    return { items: [...state.items, newItem] };
  }),
  
  addCounter: (title, step) => set((state) => {
    const newItem: CounterItem = {
      id: nanoid(),
      type: 'counter',
      title,
      step,
      current: 0,
      createdAt: Date.now(),
    };
    return { items: [...state.items, newItem] };
  }),
  
  updateCurrent: (id, delta) => set((state) => {
    const newItems = state.items.map((item): ProgressOrCounter => {
      if (item.id !== id) return item;
      
      if (item.type === 'progress') {
        const newCurrent = Math.max(0, Math.min(item.total, item.current + delta));
        return { ...item, current: newCurrent };
      } else {
        return { ...item, current: item.current + delta };
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
