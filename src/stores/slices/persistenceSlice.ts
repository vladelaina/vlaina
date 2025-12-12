import { StateCreator } from 'zustand';
import { loadGroups, loadGroup } from '@/lib/storage';
import { Group, StoreTask } from '../types';
import { useUIStore } from '../uiSlice';
import { archiveCompletedTasksForGroup, archiveSingleTaskWithDescendants, loadArchivedTasks } from '../archiveUtils';
import { StoreState } from '../storeTypes';

export interface PersistenceSlice {
  loaded: boolean;
  loadedGroups: Set<string>;
  
  loadData: () => Promise<void>;
  loadGroupTasks: (groupId: string) => Promise<void>;
  archiveCompletedTasks: (groupId: string) => Promise<void>;
  archiveSingleTask: (taskId: string) => Promise<void>;
}

export const createPersistenceSlice: StateCreator<StoreState, [], [], PersistenceSlice> = (set, get) => ({
  loaded: false,
  loadedGroups: new Set<string>(),

  loadData: async () => {
    console.log('[LazyLoad] Loading group metadata only (not tasks)');
    const allGroups = await loadGroups();
    const groups: Group[] = [];
    
    // Only load group metadata, not tasks
    for (const gd of allGroups) {
      groups.push({
        id: gd.id,
        name: gd.name,
        pinned: gd.pinned,
        createdAt: gd.createdAt,
        updatedAt: gd.updatedAt,
      });
    }
    
    // Sort by pinned status
    groups.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
    
    console.log(`[LazyLoad] Loaded ${groups.length} groups without tasks`);
    
    // Get current activeGroupId, initialize previousNonArchiveGroupId
    const currentActiveId = get().activeGroupId;
    const initialPreviousNonArchive = (currentActiveId && currentActiveId !== '__archive__') ? currentActiveId : null;
    
    set({ groups, tasks: [], loaded: true, loadedGroups: new Set(), previousNonArchiveGroupId: initialPreviousNonArchive });
    
    // Auto-load tasks for initial active group
    const { activeGroupId, loadGroupTasks } = get();
    if (activeGroupId) {
      await loadGroupTasks(activeGroupId);
    }
  },

  loadGroupTasks: async (groupId) => {
    const state = get();
    
    // Skip if already loaded
    if (state.loadedGroups.has(groupId)) {
      console.log(`[LazyLoad] Group ${groupId} already loaded, skipping`);
      return;
    }
    
    // Mark as loading immediately to prevent duplicate loads (race condition protection)
    set((state) => ({
      loadedGroups: new Set([...state.loadedGroups, groupId])
    }));
    
    console.log(`[LazyLoad] Loading tasks for group: ${groupId}`);
    
    try {
      // Special handling for archive group - load archive data from all groups
      if (groupId === '__archive__') {
        const currentState = get();
        const maxDays = useUIStore.getState().getArchiveMaxDays();
        const archiveTasks = await loadArchivedTasks(currentState.groups, maxDays);
        
        set((state) => {
          const existingIds = new Set(state.tasks.map(t => t.id));
          const tasksToAdd = archiveTasks.filter(t => !existingIds.has(t.id));
          if (tasksToAdd.length < archiveTasks.length) {
            console.warn(`[LazyLoad] Skipped ${archiveTasks.length - tasksToAdd.length} duplicate archived tasks`);
          }
          return { tasks: [...state.tasks, ...tasksToAdd] };
        });
        return;
      }
      
      const groupData = await loadGroup(groupId);
      
      if (!groupData) {
        console.warn(`[LazyLoad] Group ${groupId} not found`);
        // Group not found, remove loading flag (may be deleted or corrupted)
        set((state) => {
          const newLoadedGroups = new Set(state.loadedGroups);
          newLoadedGroups.delete(groupId);
          return { loadedGroups: newLoadedGroups };
        });
        return;
      }
      
      // Deduplicate and convert tasks
      const seenIds = new Set<string>();
      const newTasks: StoreTask[] = [];
      
      for (const td of groupData.tasks) {
        if (seenIds.has(td.id)) {
          continue; // Skip duplicate
        }
        seenIds.add(td.id);
        
        newTasks.push({
          id: td.id,
          content: td.content,
          completed: td.completed,
          createdAt: td.createdAt,
          completedAt: td.completedAt,
          scheduledTime: td.scheduledTime,
          order: td.order,
          groupId: groupId,
          parentId: td.parentId,
          collapsed: td.collapsed,
          priority: td.priority,
          estimatedMinutes: td.estimatedMinutes,
          actualMinutes: td.actualMinutes,
        });
      }
      
      console.log(`[LazyLoad] Loaded ${newTasks.length} tasks for group ${groupId}`);
      
      // Merge into existing task list (deduplicate: exclude existing tasks)
      set((state) => {
        const existingIds = new Set(state.tasks.map(t => t.id));
        const tasksToAdd = newTasks.filter(t => !existingIds.has(t.id));
        if (tasksToAdd.length < newTasks.length) {
          console.warn(`[LazyLoad] Skipped ${newTasks.length - tasksToAdd.length} duplicate tasks`);
        }
        return {
          tasks: [...state.tasks, ...tasksToAdd]
        };
      });
    } catch (error) {
      console.error(`[LazyLoad] Failed to load tasks for group ${groupId}:`, error);
      
      // Remove loading flag on failure to allow retry
      set((state) => {
        const newLoadedGroups = new Set(state.loadedGroups);
        newLoadedGroups.delete(groupId);
        return { loadedGroups: newLoadedGroups };
      });
    }
  },

  archiveCompletedTasks: async (groupId) => {
    try {
      const { tasks, groups } = get();
      const result = await archiveCompletedTasksForGroup(groupId, tasks, groups);
      if (result.success && result.archivedCount > 0) {
        set({ tasks: result.newTasks });
      }
    } catch (error) {
      console.error('[Store] Archive completed tasks failed:', error);
    }
  },
  
  archiveSingleTask: async (taskId) => {
    try {
      const { tasks, groups } = get();
      const result = await archiveSingleTaskWithDescendants(taskId, tasks, groups);
      if (result.success) {
        set({ tasks: result.newTasks });
      }
    } catch (error) {
      console.error('[Store] Archive single task failed:', error);
    }
  },
});
