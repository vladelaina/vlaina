// Group Store - Todo view data access layer

import { useUnifiedStore } from './useUnifiedStore';
import { useUIStore } from './uiSlice';
import { DEFAULT_GROUP_ID } from '@/lib/config';

import type { Task, Group, ItemColor } from './types';

export type { Task, Group, ItemColor };
export { useUIStore };

export function useGroupStore() {
  const store = useUnifiedStore();

  return {
    groups: store.data.groups as Group[],
    tasks: store.data.tasks as Task[],
    loaded: store.loaded,
    activeGroupId: store.activeGroupId,

    setActiveGroup: (id: string | null) => store.setActiveGroup(id || DEFAULT_GROUP_ID),
    addGroup: store.addGroup,
    updateGroup: store.updateGroup,
    deleteGroup: store.deleteGroup,
    togglePin: store.toggleGroupPin,
    reorderGroups: store.reorderGroups,

    addTask: store.addTask,
    addSubTask: store.addSubTask,
    updateTask: store.updateTask,
    updateTaskEstimation: store.updateTaskEstimation,
    updateTaskColor: store.updateTaskColor,
    updateTaskIcon: store.updateTaskIcon,
    updateTaskParent: store.updateTaskParent,
    updateTaskTime: store.updateTaskTime,
    toggleTask: store.toggleTask,
    toggleCollapse: store.toggleTaskCollapse,
    deleteTask: store.deleteTask,
    deleteCompletedTasks: store.deleteCompletedTasks,
    reorderTasks: store.reorderTasks,
    moveTaskToGroup: store.moveTaskToGroup,
    archiveCompletedTasks: store.archiveCompletedTasks,

    loadData: store.load,
  };
}

useGroupStore.getState = () => {
  const store = useUnifiedStore.getState();
  return {
    groups: store.data.groups as Group[],
    tasks: store.data.tasks as Task[],
    loaded: store.loaded,
    activeGroupId: store.activeGroupId,
    updateTaskParent: store.updateTaskParent,
    updateTaskColor: store.updateTaskColor,
    updateTaskEstimation: store.updateTaskEstimation,
    updateTaskIcon: store.updateTaskIcon,
  };
};

export type GroupStore = ReturnType<typeof useGroupStore>;
