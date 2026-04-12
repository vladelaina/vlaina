import { useMemo } from 'react';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import type { UnifiedProgress } from '@/lib/storage/unifiedStorage';
import { getTodayKey } from '@/lib/date';
import { normalizeTags } from '@/lib/tags/tagUtils';

export interface ProgressItem {
  id: string;
  type: 'progress';
  title: string;
  tags?: string[];
  icon?: string;
  direction: 'increment' | 'decrement';
  total: number;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>;
  startDate?: number;
  endDate?: number;
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
  createdAt: number;
  archived?: boolean;
}

export interface CounterItem {
  id: string;
  type: 'counter';
  title: string;
  tags?: string[];
  icon?: string;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>;
  frequency: 'daily' | 'weekly' | 'monthly';
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
  createdAt: number;
  archived?: boolean;
}

export type ProgressOrCounter = ProgressItem | CounterItem;

function toProgressOrCounter(item: UnifiedProgress): ProgressOrCounter {
  if (item.type === 'progress') {
    return {
      id: item.id,
      type: 'progress',
      title: item.title,
      tags: normalizeTags(item.tags),
      icon: item.icon,
      direction: item.direction || 'increment',
      total: item.total || 100,
      step: item.step,
      unit: item.unit,
      current: item.current,
      todayCount: item.todayCount,
      lastUpdateDate: item.lastUpdateDate,
      history: item.history,
      resetFrequency: item.resetFrequency || 'none',
      createdAt: item.createdAt,
      archived: item.archived || false,
    };
  }
  return {
    id: item.id,
    type: 'counter',
    title: item.title,
    tags: normalizeTags(item.tags),
    icon: item.icon,
    step: item.step,
    unit: item.unit,
    current: item.current,
    todayCount: item.todayCount,
    lastUpdateDate: item.lastUpdateDate,
    history: item.history,
    frequency: item.frequency || 'daily',
    resetFrequency: item.resetFrequency || 'none',
    createdAt: item.createdAt,
    archived: item.archived || false,
  };
}

export function useProgressStore() {
  const progress = useUnifiedStore(s => s.data.progress);
  const loaded = useUnifiedStore(s => s.loaded);
  const load = useUnifiedStore(s => s.load);
  const addProgress = useUnifiedStore(s => s.addProgress);
  const updateProgress = useUnifiedStore(s => s.updateProgress);
  const deleteProgress = useUnifiedStore(s => s.deleteProgress);
  const toggleProgressArchive = useUnifiedStore(s => s.toggleProgressArchive);
  const updateProgressItem = useUnifiedStore(s => s.updateProgressItem);
  const reorderProgress = useUnifiedStore(s => s.reorderProgress);

  const items = useMemo(() => progress.map(toProgressOrCounter), [progress]);

  return {
    items,
    loaded,
    
    loadItems: load,
    
    addProgress: (data: Omit<ProgressItem, 'id' | 'type' | 'current' | 'todayCount' | 'createdAt'>) => {
      addProgress({
        type: 'progress',
        title: data.title,
        tags: normalizeTags(data.tags),
        icon: data.icon,
        direction: data.direction,
        total: data.total,
        step: data.step,
        unit: data.unit,
        resetFrequency: data.resetFrequency || 'none',
      });
    },
    
    addCounter: (data: { title: string; tags?: string[]; icon?: string; step: number; unit: string; frequency: 'daily' | 'weekly' | 'monthly'; resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none' }) => {
      addProgress({
        type: 'counter',
        title: data.title,
        tags: normalizeTags(data.tags),
        icon: data.icon,
        step: data.step,
        unit: data.unit,
        frequency: data.frequency,
        resetFrequency: data.resetFrequency || 'none',
      });
    },
    
    updateCurrent: updateProgress,
    deleteItem: deleteProgress,
    toggleArchive: toggleProgressArchive,
    updateItem: updateProgressItem,
    reorderItems: reorderProgress,
    
    validateDailyState: () => {
      const todayKey = getTodayKey();
      const currentProgress = useUnifiedStore.getState().data.progress;
      
      currentProgress.forEach(item => {
        if (item.resetFrequency === 'daily' && item.lastUpdateDate !== todayKey) {
          updateProgressItem(item.id, {
            current: 0,
            todayCount: 0,
            lastUpdateDate: todayKey,
          });
        }
      });
    },
  };
}

useProgressStore.getState = () => {
  const store = useUnifiedStore.getState();
  return {
    items: store.data.progress.map(toProgressOrCounter),
    loaded: store.loaded,
    validateDailyState: () => {
      const todayKey = getTodayKey();
      store.data.progress.forEach(item => {
        if (item.resetFrequency === 'daily' && item.lastUpdateDate !== todayKey) {
          store.updateProgressItem(item.id, {
            current: 0,
            todayCount: 0,
            lastUpdateDate: todayKey,
          });
        }
      });
    },
  };
};
