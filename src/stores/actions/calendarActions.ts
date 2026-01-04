// Calendar Actions

import { nanoid } from 'nanoid';
import type { UnifiedData, UnifiedTask } from '@/lib/storage/unifiedStorage';
import { getValidColor } from '@/lib/colors';
import { DEFAULT_EVENT_DURATION_MS } from '@/lib/calendar';
import { DEFAULT_GROUP_ID } from '@/lib/config';
import { MS_PER_MINUTE } from '@/lib/time/constants';
import type { UndoAction } from '../types';

type SetState = (fn: (state: { 
  data: UnifiedData; 
  undoStack: UndoAction[];
}) => Partial<{ 
  data: UnifiedData; 
  undoStack: UndoAction[];
}>) => void;

type GetState = () => { 
  data: UnifiedData; 
  undoStack: UndoAction[];
};

type Persist = (data: UnifiedData) => void;

export function createCalendarActions(set: SetState, _get: GetState, persist: Persist) {
  return {
    updateTaskTime: (id: string, startDate?: number | null, endDate?: number | null, isAllDay?: boolean) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t => {
            if (t.id !== id) return t;
            
            const newStartDate = startDate === null ? undefined : (startDate !== undefined ? startDate : t.startDate);
            const newEndDate = endDate === null ? undefined : (endDate !== undefined ? endDate : t.endDate);
            
            return { 
              ...t, 
              startDate: newStartDate, 
              endDate: newEndDate,
              isAllDay: isAllDay ?? t.isAllDay,
            };
          }),
        };
        persist(newData);
        return { data: newData };
      });
    },

    addEvent: (eventData: { 
      content: string; 
      startDate: number; 
      endDate: number; 
      isAllDay: boolean; 
      color?: string;
      groupId?: string;
    }) => {
      const newTask: UnifiedTask = {
        id: nanoid(),
        content: eventData.content,
        completed: false,
        createdAt: Date.now(),
        order: 0,
        groupId: eventData.groupId || DEFAULT_GROUP_ID,
        parentId: null,
        collapsed: false,
        color: getValidColor(eventData.color),
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        isAllDay: eventData.isAllDay,
      };
      set((state) => {
        const newData = {
          ...state.data,
          tasks: [...state.data.tasks, newTask],
        };
        persist(newData);
        return { data: newData };
      });
      return newTask.id;
    },

    updateEvent: (id: string, updates: Partial<UnifiedTask>) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t => {
            if (t.id !== id) return t;
            const newTask = { ...t };
            if ('content' in updates) newTask.content = updates.content as string;
            if ('startDate' in updates) newTask.startDate = updates.startDate;
            if ('endDate' in updates) newTask.endDate = updates.endDate;
            if ('isAllDay' in updates) newTask.isAllDay = updates.isAllDay;
            if ('color' in updates) newTask.color = getValidColor(updates.color) || t.color;
            if ('description' in updates) newTask.description = updates.description;
            if ('location' in updates) newTask.location = updates.location;
            if ('groupId' in updates) newTask.groupId = updates.groupId as string;
            if ('icon' in updates) newTask.icon = updates.icon;
            return newTask;
          }),
        };
        persist(newData);
        return { data: newData };
      });
    },

    deleteEvent: (id: string) => {
      set((state) => {
        const taskToDelete = state.data.tasks.find(t => t.id === id);
        const newData = {
          ...state.data,
          tasks: state.data.tasks.filter(t => t.id !== id),
        };
        persist(newData);
        
        const newUndoStack = taskToDelete
          ? [...state.undoStack, { type: 'deleteTask' as const, task: taskToDelete }].slice(-20)
          : state.undoStack;
        
        return {
          data: newData,
          undoStack: newUndoStack,
        };
      });
    },

    undo: () => {
      set((state) => {
        if (state.undoStack.length === 0) return state;
        
        const lastAction = state.undoStack[state.undoStack.length - 1];
        const newUndoStack = state.undoStack.slice(0, -1);
        
        if (lastAction.type === 'deleteTask') {
          const newData = {
            ...state.data,
            tasks: [...state.data.tasks, lastAction.task],
          };
          persist(newData);
          return { data: newData, undoStack: newUndoStack };
        }
        
        return { undoStack: newUndoStack };
      });
    },

    // Timer Actions
    startTimer: (id: string) => {
      const now = Date.now();
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t => {
            if (t.id !== id) return t;
            
            const duration = t.endDate && t.startDate ? t.endDate - t.startDate : DEFAULT_EVENT_DURATION_MS;
            
            return {
              ...t,
              timerState: 'running' as const,
              timerStartedAt: now,
              timerAccumulated: t.timerAccumulated || 0,
              startDate: now,
              endDate: now + duration,
            };
          }),
        };
        persist(newData);
        return { data: newData };
      });
    },

    pauseTimer: (id: string) => {
      const now = Date.now();
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t => {
            if (t.id !== id) return t;
            const elapsed = now - (t.timerStartedAt || now);
            return {
              ...t,
              timerState: 'paused' as const,
              timerAccumulated: (t.timerAccumulated || 0) + elapsed,
              timerStartedAt: undefined,
            };
          }),
        };
        persist(newData);
        return { data: newData };
      });
    },

    resumeTimer: (id: string) => {
      const now = Date.now();
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t => {
            if (t.id !== id) return t;
            return {
              ...t,
              timerState: 'running' as const,
              timerStartedAt: now,
            };
          }),
        };
        persist(newData);
        return { data: newData };
      });
    },

    stopTimer: (id: string) => {
      const now = Date.now();
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t => {
            if (t.id !== id) return t;
            
            let totalMs = t.timerAccumulated || 0;
            if (t.timerState === 'running' && t.timerStartedAt) {
              totalMs += now - t.timerStartedAt;
            }
            const actualMinutes = Math.round(totalMs / MS_PER_MINUTE);
            
            return {
              ...t,
              timerState: 'idle' as const,
              timerStartedAt: undefined,
              timerAccumulated: undefined,
              actualMinutes,
              completed: true,
              completedAt: now,
            };
          }),
        };
        persist(newData);
        return { data: newData };
      });
    },
  };
}
