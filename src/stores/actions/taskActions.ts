// Task Actions

import { nanoid } from 'nanoid';
import type { UnifiedData, UnifiedTask } from '@/lib/storage/unifiedStorage';
import { type ItemColor, DEFAULT_COLOR } from '@/lib/colors';
import { MS_PER_MINUTE } from '@/lib/time/constants';
import { getDescendantIds, getChildren, reorderSiblings } from '../taskTreeUtils';

type SetState = (fn: (state: { data: UnifiedData }) => Partial<{ data: UnifiedData }>) => void;
type GetState = () => { data: UnifiedData };
type Persist = (data: UnifiedData) => void;

export function createTaskActions(set: SetState, get: GetState, persist: Persist) {
  return {
    addTask: (content: string, groupId: string, color: ItemColor = DEFAULT_COLOR) => {
      // Logic: New tasks go to the bottom of the list (incomplete, root level)
      const groupTasks = get().data.tasks.filter(t => t.groupId === groupId && !t.parentId && !t.startDate);
      const newTask: UnifiedTask = {
        id: nanoid(),
        content,
        completed: false,
        createdAt: Date.now(),
        order: groupTasks.length,
        groupId,
        parentId: null,
        collapsed: false,
        color,
      };
      set((state) => {
        const newData = {
          ...state.data,
          tasks: [...state.data.tasks, newTask],
        };
        persist(newData);
        return { data: newData };
      });
    },

    addSubTask: (parentId: string, content: string) => {
      const parent = get().data.tasks.find(t => t.id === parentId);
      if (!parent) return;
      
      const siblings = getChildren(get().data.tasks, parentId);
      const newTask: UnifiedTask = {
        id: nanoid(),
        content,
        completed: false,
        createdAt: Date.now(),
        order: siblings.length,
        groupId: parent.groupId,
        parentId,
        collapsed: false,
        color: parent.color || DEFAULT_COLOR,
      };
      set((state) => {
        const newData = {
          ...state.data,
          tasks: [...state.data.tasks, newTask],
        };
        persist(newData);
        return { data: newData };
      });
    },

    updateTask: (id: string, content: string) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t =>
            t.id === id ? { ...t, content } : t
          ),
        };
        persist(newData);
        return { data: newData };
      });
    },

    updateTaskColor: (id: string, color: ItemColor) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t =>
            t.id === id ? { ...t, color } : t
          ),
        };
        persist(newData);
        return { data: newData };
      });
    },

    updateTaskEstimation: (id: string, estimatedMinutes?: number) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t =>
            t.id === id ? { ...t, estimatedMinutes } : t
          ),
        };
        persist(newData);
        return { data: newData };
      });
    },

    updateTaskIcon: (id: string, icon?: string) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t =>
            t.id === id ? { ...t, icon } : t
          ),
        };
        persist(newData);
        return { data: newData };
      });
    },

    updateTaskParent: (id: string, parentId: string | null, order: number) => {
      set((state) => {
        const task = state.data.tasks.find(t => t.id === id);
        if (!task) return state;
        
        const oldParentId = task.parentId;
        let newTasks = state.data.tasks.map(t =>
          t.id === id ? { ...t, parentId, order } : t
        );
        
        // If parent changed, reorder old siblings
        if (oldParentId !== parentId) {
          const oldSiblings = getChildren(newTasks, oldParentId, task.groupId)
            .filter(t => t.id !== id);
          
          const reorderedOldSiblings = reorderSiblings(oldSiblings, 0, 0); // Just triggers re-index logic effectively
          
          // Apply new orders
          reorderedOldSiblings.forEach((t, i) => {
             const target = newTasks.find(nt => nt.id === t.id);
             if (target) target.order = i;
          });
        }
        
        const newData = { ...state.data, tasks: newTasks };
        persist(newData);
        return { data: newData };
      });
    },

    toggleTask: (id: string) => {
      set((state) => {
        const task = state.data.tasks.find(t => t.id === id);
        if (!task) return state;
        
        const isCompleting = !task.completed;
        const now = Date.now();
        
        let actualMinutes = task.actualMinutes;
        if (isCompleting && (task.timerState === 'running' || task.timerState === 'paused')) {
          let totalMs = task.timerAccumulated || 0;
          if (task.timerState === 'running' && task.timerStartedAt) {
            totalMs += now - task.timerStartedAt;
          }
          actualMinutes = Math.round(totalMs / MS_PER_MINUTE);
        }
        
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t =>
            t.id === id ? {
              ...t,
              completed: isCompleting,
              completedAt: isCompleting ? now : undefined,
              timerState: isCompleting ? ('idle' as const) : t.timerState,
              timerStartedAt: isCompleting ? undefined : t.timerStartedAt,
              timerAccumulated: isCompleting ? undefined : t.timerAccumulated,
              actualMinutes: isCompleting ? actualMinutes : t.actualMinutes,
            } : t
          ),
        };
        persist(newData);
        return { data: newData };
      });
    },

    toggleTaskCollapse: (id: string) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.map(t =>
            t.id === id ? { ...t, collapsed: !t.collapsed } : t
          ),
        };
        persist(newData);
        return { data: newData };
      });
    },

    deleteTask: (id: string) => {
      set((state) => {
        // Use utility to safely find all descendants
        const idsToDelete = new Set(getDescendantIds(state.data.tasks, id));
        
        const newData = {
          ...state.data,
          tasks: state.data.tasks.filter(t => !idsToDelete.has(t.id)),
        };
        persist(newData);
        return { data: newData };
      });
    },

    deleteCompletedTasks: (groupId: string) => {
      set((state) => {
        const newData = {
          ...state.data,
          tasks: state.data.tasks.filter(t => t.groupId !== groupId || !t.completed),
        };
        persist(newData);
        return { data: newData };
      });
    },

    reorderTasks: (activeId: string, overId: string) => {
      set((state) => {
        const tasks = state.data.tasks;
        const activeTask = tasks.find(t => t.id === activeId);
        const overTask = tasks.find(t => t.id === overId);
        
        if (!activeTask || !overTask) return state;
        if (activeTask.groupId !== overTask.groupId) return state;
        if (activeTask.parentId !== overTask.parentId) return state;
        
        // Get siblings sorted
        const siblings = getChildren(tasks, activeTask.parentId, activeTask.groupId);
        
        const oldIndex = siblings.findIndex(t => t.id === activeId);
        const newIndex = siblings.findIndex(t => t.id === overId);
        
        if (oldIndex === -1 || newIndex === -1) return state;
        
        // Use utility to calculate new orders
        const reorderedSiblings = reorderSiblings(siblings, oldIndex, newIndex);
        
        // Apply updates to the main list
        const orderMap = new Map(reorderedSiblings.map(t => [t.id, t.order]));
        
        const newTasks = tasks.map(t => {
            if (orderMap.has(t.id)) {
                return { ...t, order: orderMap.get(t.id)! };
            }
            return t;
        });
        
        const newData = { ...state.data, tasks: newTasks };
        persist(newData);
        return { data: newData };
      });
    },

    moveTaskToGroup: (taskId: string, targetGroupId: string, overTaskId?: string | null) => {
      set((state) => {
        const task = state.data.tasks.find(t => t.id === taskId);
        if (!task) return state;
        
        // Use utility to identify the whole subtree
        const idsToMove = new Set(getDescendantIds(state.data.tasks, taskId));
        
        // Calculate new order in target group
        const targetTasks = getChildren(state.data.tasks, null, targetGroupId);
        let newOrder = targetTasks.length;
        
        if (overTaskId) {
          const overTask = state.data.tasks.find(t => t.id === overTaskId);
          if (overTask && overTask.groupId === targetGroupId) {
            newOrder = overTask.order;
          }
        }
        
        const newTasks = state.data.tasks.map(t => {
          if (t.id === taskId) {
            return { ...t, groupId: targetGroupId, order: newOrder, parentId: null };
          }
          if (idsToMove.has(t.id)) {
            return { ...t, groupId: targetGroupId };
          }
          return t;
        });
        
        const newData = { ...state.data, tasks: newTasks };
        persist(newData);
        return { data: newData };
      });
    },

    archiveCompletedTasks: (groupId: string) => {
      set((state) => {
        const completedTasks = state.data.tasks.filter(t => t.groupId === groupId && t.completed);
        if (completedTasks.length === 0) return state;
        
        const archiveEntry = {
          timestamp: Date.now(),
          tasks: completedTasks.map(t => ({
            content: t.content,
            completedAt: t.completedAt,
            createdAt: t.createdAt,
            color: t.color,
            estimatedMinutes: t.estimatedMinutes,
            actualMinutes: t.actualMinutes,
            groupId: t.groupId,
          })),
        };
        
        const newData = {
          ...state.data,
          tasks: state.data.tasks.filter(t => t.groupId !== groupId || !t.completed),
          archive: [archiveEntry, ...state.data.archive],
        };
        persist(newData);
        return { data: newData };
      });
    },
  };
}
