/**
 * Settings Actions - 设置相关操作（数据持久化设置）
 * 
 * 注意：UI 状态操作（toggleSidebar, toggleContextPanel, setSelectedDate）
 * 已迁移到 UIStore (src/stores/uiSlice.ts)
 */

import type { UnifiedData } from '@/lib/storage/unifiedStorage';
import type { TimeView } from '@/lib/date';

type SetState = (fn: (state: { 
  data: UnifiedData; 
}) => Partial<{ 
  data: UnifiedData; 
}>) => void;

type Persist = (data: UnifiedData) => void;

export function createSettingsActions(set: SetState, persist: Persist) {
  return {
    setTimezone: (tz: number) => {
      set((state) => {
        const newData = {
          ...state.data,
          settings: { ...state.data.settings, timezone: Math.max(-12, Math.min(14, tz)) },
        };
        persist(newData);
        return { data: newData };
      });
    },

    setViewMode: (mode: TimeView) => {
      set((state) => {
        const newData = {
          ...state.data,
          settings: { ...state.data.settings, viewMode: mode },
        };
        persist(newData);
        return { data: newData };
      });
    },

    setDayCount: (count: number) => {
      set((state) => {
        const newData = {
          ...state.data,
          settings: { ...state.data.settings, dayCount: Math.max(1, Math.min(14, count)) },
        };
        persist(newData);
        return { data: newData };
      });
    },

    setHourHeight: (height: number) => {
      const clampedHeight = Math.max(32, Math.min(800, height));
      set((state) => {
        const newData = {
          ...state.data,
          settings: { ...state.data.settings, hourHeight: clampedHeight },
        };
        persist(newData);
        return { data: newData };
      });
    },
    
    toggle24Hour: () => {
      set((state) => {
        const newData = {
          ...state.data,
          settings: { ...state.data.settings, use24Hour: !state.data.settings.use24Hour },
        };
        persist(newData);
        return { data: newData };
      });
    },

    setDayStartTime: (minutes: number) => {
      // 限制在 0-1439 分钟范围内
      const clampedMinutes = Math.max(0, Math.min(1439, minutes));
      set((state) => {
        const newData = {
          ...state.data,
          settings: { ...state.data.settings, dayStartTime: clampedMinutes },
        };
        persist(newData);
        return { data: newData };
      });
    },
  };
}
