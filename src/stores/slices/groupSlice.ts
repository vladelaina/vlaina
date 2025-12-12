import { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import { deleteGroup as deleteGroupFile } from '@/lib/storage';
import { Group, StoreTask } from '../types';
import { persistGroup } from '../taskUtils';
import { StoreState } from '../useGroupStore';

export interface GroupSlice {
  groups: Group[];
  activeGroupId: string | null;
  previousNonArchiveGroupId: string | null;
  
  setActiveGroup: (id: string | null) => Promise<void>;
  addGroup: (name: string) => void;
  updateGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  togglePin: (id: string) => void;
  reorderGroups: (activeId: string, overId: string) => void;
}

export const createGroupSlice: StateCreator<StoreState, [], [], GroupSlice> = (set, get) => ({
  groups: [],
  activeGroupId: 'default',
  previousNonArchiveGroupId: null,

  setActiveGroup: async (id) => {
    const state = get();
    const previousGroupId = state.activeGroupId;
    
    console.log(`[GroupStore] Switching from ${previousGroupId} to ${id}`);
    
    // If switching from archive to another group, clear archive tasks
    if (previousGroupId === '__archive__' && id !== '__archive__') {
      set((state) => ({
        activeGroupId: id,
        previousNonArchiveGroupId: id, // Update to new active group
        tasks: state.tasks.filter(t => t.groupId !== '__archive__'),
        loadedGroups: new Set([...state.loadedGroups].filter(g => g !== '__archive__'))
      }));
    } else if (id === '__archive__' && previousGroupId !== '__archive__') {
      // When switching to archive, save current group ID and clear archive flag for reload
      console.log(`[GroupStore] Saving previousNonArchiveGroupId: ${previousGroupId}`);
      set((state) => ({
        activeGroupId: id,
        previousNonArchiveGroupId: previousGroupId,
        tasks: state.tasks.filter(t => t.groupId !== '__archive__'),
        loadedGroups: new Set([...state.loadedGroups].filter(g => g !== '__archive__'))
      }));
    } else if (id !== '__archive__') {
      // When switching to regular group, update previousNonArchiveGroupId
      set({ activeGroupId: id, previousNonArchiveGroupId: id });
    } else {
      set({ activeGroupId: id });
    }
    
    // Lazy load: auto-load group tasks if not yet loaded
    if (id) {
      await get().loadGroupTasks(id);
    }
  },

  addGroup: (name) => {
    const newGroup: Group = {
      id: nanoid(),
      name,
      createdAt: Date.now(),
    };
    
    set((state) => {
      const newGroups = [...state.groups, newGroup];
      persistGroup(newGroups, state.tasks, newGroup.id);
      // New group has no tasks, mark as loaded
      return { 
        groups: newGroups,
        loadedGroups: new Set([...state.loadedGroups, newGroup.id])
      };
    });
  },
  
  updateGroup: (id, name) => set((state) => {
    const newGroups = state.groups.map((g) =>
      g.id === id ? { ...g, name } : g
    );
    persistGroup(newGroups, state.tasks, id);
    return { groups: newGroups };
  }),
  
  deleteGroup: (id) => set((state) => {
    if (id === 'default') return state;
    deleteGroupFile(id);
    
    // Clean up loadedGroups
    const newLoadedGroups = new Set(state.loadedGroups);
    newLoadedGroups.delete(id);
    
    return {
      groups: state.groups.filter((g) => g.id !== id),
      tasks: state.tasks.filter((t) => t.groupId !== id),
      activeGroupId: state.activeGroupId === id ? 'default' : state.activeGroupId,
      loadedGroups: newLoadedGroups,
    };
  }),
  
  togglePin: (id) => set((state) => {
    const group = state.groups.find(g => g.id === id);
    if (!group) return state;
    
    const newPinned = !group.pinned;
    const updatedGroup = { ...group, pinned: newPinned };
    const otherGroups = state.groups.filter(g => g.id !== id);
    
    let newGroups: Group[];
    if (newPinned) {
      newGroups = [updatedGroup, ...otherGroups];
    } else {
      const pinnedGroups = otherGroups.filter(g => g.pinned);
      const unpinnedGroups = otherGroups.filter(g => !g.pinned);
      newGroups = [...pinnedGroups, updatedGroup, ...unpinnedGroups];
    }
    
    persistGroup(newGroups, state.tasks, id);
    return { groups: newGroups };
  }),
  
  reorderGroups: (activeId, overId) => set((state) => {
    const oldIndex = state.groups.findIndex((g) => g.id === activeId);
    const newIndex = state.groups.findIndex((g) => g.id === overId);
    
    if (oldIndex === -1 || newIndex === -1) return state;
    
    const newGroups = [...state.groups];
    const [removed] = newGroups.splice(oldIndex, 1);
    newGroups.splice(newIndex, 0, removed);
    
    return { groups: newGroups };
  }),
});
