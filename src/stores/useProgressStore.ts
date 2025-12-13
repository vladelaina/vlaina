import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { loadProgress, saveProgress, type ProgressData } from '@/lib/storage';

export interface ProgressItem {
  id: string;
  type: 'progress';
  title: string;
  icon?: string;
  direction: 'increment' | 'decrement';
  total: number;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>; // { "2025-12-05": 3, ... } 每天操作次数
  startDate?: number;
  endDate?: number;
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none'; // Added resetFrequency
  createdAt: number;
  archived?: boolean;
}

export interface CounterItem {
  id: string;
  type: 'counter';
  title: string;
  icon?: string;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>; // { "2025-12-05": 3, ... } 每天操作次数
  frequency: 'daily' | 'weekly' | 'monthly'; // For display, not reset
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none'; // New field for auto-reset behavior
  createdAt: number;
  archived?: boolean;
}

export type ProgressOrCounter = ProgressItem | CounterItem;

interface ProgressStore {
  items: ProgressOrCounter[];
  loaded: boolean;
  
  loadItems: () => Promise<void>;
  addProgress: (data: Omit<ProgressItem, 'id' | 'type' | 'current' | 'todayCount' | 'createdAt'>) => void;
  addCounter: (data: { title: string; icon?: string; step: number; unit: string; frequency: 'daily' | 'weekly' | 'monthly' }) => void;
  updateCurrent: (id: string, delta: number) => void;
  deleteItem: (id: string) => void;
  toggleArchive: (id: string) => void;
  updateItem: (id: string, data: Partial<ProgressOrCounter>) => void;
  reorderItems: (activeId: string, overId: string) => void;
  validateDailyState: () => void;
}

// Helper: Get local YYYY-MM-DD key
function getLocalTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Check and reset daily items
function checkAndResetDailyItems(items: ProgressData[]): { items: ProgressData[]; hasChanges: boolean } {
  let hasChanges = false;
  const todayKey = getLocalTodayKey(); // "2025-12-13"

  const newItems = items.map(item => {
    // Only process items with daily reset frequency
    if (item.resetFrequency === 'daily') {
      // Strict check: If last update is not EXACTLY today's key, reset it.
      // This handles both legitimate new days AND legacy format cleanup (legacy != todayKey)
      if (item.lastUpdateDate !== todayKey) {
        hasChanges = true;
        return {
          ...item,
          current: 0,
          todayCount: 0,
          lastUpdateDate: todayKey, // Update to standard format
        };
      }
    }
    return item;
  });

  return { items: newItems, hasChanges };
}

// 转换存储格式到 store 格式
function fromStorageFormat(data: ProgressData): ProgressOrCounter {
  if (data.type === 'progress') {
    return {
      id: data.id,
      type: 'progress',
      title: data.title,
      icon: data.icon,
      direction: data.direction || 'increment',
      total: data.total || 100,
      step: data.step,
      unit: data.unit,
      current: data.current,
      todayCount: data.todayCount,
      lastUpdateDate: data.lastUpdateDate,
      history: data.history,
      startDate: data.startDate,
      endDate: data.endDate,
      resetFrequency: data.resetFrequency || 'none', // Map resetFrequency
      createdAt: data.createdAt,
      archived: data.archived || false,
    };
  } else {
    return {
      id: data.id,
      type: 'counter',
      title: data.title,
      icon: data.icon,
      step: data.step,
      unit: data.unit,
      current: data.current,
      todayCount: data.todayCount,
      lastUpdateDate: data.lastUpdateDate,
      history: data.history,
      frequency: data.frequency || 'daily',
      resetFrequency: data.resetFrequency || 'none', // Handle new field
      createdAt: data.createdAt,
      archived: data.archived || false,
    };
  }
}

// 转换 store 格式到存储格式
function toStorageFormat(item: ProgressOrCounter): ProgressData {
  if (item.type === 'progress') {
    return {
      id: item.id,
      type: 'progress',
      title: item.title,
      icon: item.icon,
      direction: item.direction,
      total: item.total,
      step: item.step,
      unit: item.unit,
      current: item.current,
      todayCount: item.todayCount,
      lastUpdateDate: item.lastUpdateDate,
      history: item.history,
      startDate: item.startDate,
      endDate: item.endDate,
      resetFrequency: item.resetFrequency, // Map resetFrequency
      createdAt: item.createdAt,
      archived: item.archived,
    };
  } else {
    return {
      id: item.id,
      type: 'counter',
      title: item.title,
      icon: item.icon,
      step: item.step,
      unit: item.unit,
      current: item.current,
      todayCount: item.todayCount,
      lastUpdateDate: item.lastUpdateDate,
      history: item.history,
      frequency: item.frequency,
      resetFrequency: item.resetFrequency, // Handle new field
      createdAt: item.createdAt,
      archived: item.archived,
    };
  }
}

// 保存到文件
async function persistItems(items: ProgressOrCounter[]) {
  await saveProgress(items.map(toStorageFormat));
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  items: [],
  loaded: false,
  
  loadItems: async () => {
    if (get().loaded) return;
    let items = await loadProgress();
    
    // Initial validation on load
    const { items: validatedItems, hasChanges } = checkAndResetDailyItems(items);

    if (hasChanges) {
      console.log('[ProgressStore] Auto-resetting daily counters during load.');
      await saveProgress(validatedItems);
    }

    set({ items: validatedItems.map(fromStorageFormat), loaded: true });
  },

  // 暴露给外部调用的每日状态校验方法（午夜守夜人调用）
  validateDailyState: () => set((state) => {
    const rawItems = state.items.map(toStorageFormat);
    const { items: validatedItems, hasChanges } = checkAndResetDailyItems(rawItems);

    if (hasChanges) {
       console.log('[ProgressStore] Midnight Watchman: Resetting daily counters.');
       saveProgress(validatedItems); // Side effect: persist to disk
       return { items: validatedItems.map(fromStorageFormat) };
    }
    return state;
  }),
  
  addProgress: (data: Omit<ProgressItem, 'id' | 'type' | 'current' | 'todayCount' | 'createdAt'>) => set((state) => {
    const todayKey = getLocalTodayKey();

    const newItem: ProgressItem = {
      id: nanoid(),
      type: 'progress',
      title: data.title,
      icon: data.icon,
      direction: data.direction,
      total: data.total,
      step: data.step,
      unit: data.unit,
      current: data.direction === 'increment' ? 0 : data.total,
      todayCount: 0,
      lastUpdateDate: todayKey,
      history: {}, // Initialize empty history
      startDate: data.startDate,
      endDate: data.endDate,
      resetFrequency: data.resetFrequency || 'none',
      createdAt: Date.now(),
    };
    const newItems = [newItem, ...state.items];
    persistItems(newItems);
    return { items: newItems };
  }),
  
  addCounter: (data: { title: string; icon?: string; step: number; unit: string; frequency: 'daily' | 'weekly' | 'monthly'; resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none'; }) => set((state) => {
    const todayKey = getLocalTodayKey();

    const newItem: CounterItem = {
      id: nanoid(),
      type: 'counter',
      title: data.title,
      icon: data.icon,
      step: data.step,
      unit: data.unit,
      current: 0,
      todayCount: 0,
      lastUpdateDate: todayKey,
      history: {}, // Initialize empty history
      frequency: data.frequency,
      resetFrequency: data.resetFrequency || 'none',
      createdAt: Date.now(),
    };
    const newItems = [newItem, ...state.items];
    persistItems(newItems);
    return { items: newItems };
  }),
  
  updateCurrent: (id, delta) => set((state) => {
    const todayKey = getLocalTodayKey(); // YYYY-MM-DD
    
    const newItems = state.items.map((item): ProgressOrCounter => {
      if (item.id !== id) return item;
      
      // Strict check: Is it effectively today?
      const isNewDay = item.lastUpdateDate !== todayKey;
      
      // 1. Calculate New Today Count
      // If isNewDay, base is 0. Else base is current todayCount.
      const baseTodayCount = isNewDay ? 0 : item.todayCount;
      const newTodayCount = Math.max(0, baseTodayCount + delta); // Use delta directly
      
      // 2. Update History
      const history = { ...item.history };
      history[todayKey] = newTodayCount; 
      
      // 3. Update Current (Total)
      let newCurrent = item.current;
      if (item.type === 'progress') {
        newCurrent = Math.max(0, Math.min(item.total, item.current + delta));
      } else {
        newCurrent = item.current + delta;
      }

      return { 
        ...item, 
        current: newCurrent, 
        todayCount: newTodayCount, 
        lastUpdateDate: todayKey, // Always standardize to YYYY-MM-DD
        history 
      };
    });
    persistItems(newItems);
    return { items: newItems };
  }),
  
  deleteItem: (id) => set((state) => {
    const newItems = state.items.filter((item) => item.id !== id);
    persistItems(newItems);
    return { items: newItems };
  }),

  toggleArchive: (id) => set((state) => {
    const newItems = state.items.map((item) => 
      item.id === id ? { ...item, archived: !item.archived } : item
    );
    persistItems(newItems);
    return { items: newItems };
  }),
  
  updateItem: (id, data) => set((state) => {
    const newItems = state.items.map((item): ProgressOrCounter => {
      if (item.id !== id) return item;
      return { ...item, ...data } as ProgressOrCounter;
    });
    persistItems(newItems);
    return { items: newItems };
  }),
  
  reorderItems: (activeId, overId) => set((state) => {
    const oldIndex = state.items.findIndex((item) => item.id === activeId);
    const newIndex = state.items.findIndex((item) => item.id === overId);
    
    if (oldIndex === -1 || newIndex === -1) return state;
    
    const newItems = [...state.items];
    const [removed] = newItems.splice(oldIndex, 1);
    newItems.splice(newIndex, 0, removed);
    
    persistItems(newItems);
    return { items: newItems };
  }),
}));
