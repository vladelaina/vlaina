import { create } from 'zustand';
import { parseTimeString } from './timeParser';
import type { Group, Priority, StoreTask, ArchiveTimeView } from './types';
import { PRIORITY_COLORS } from './types';
import { useUIStore } from './uiSlice';
import { StoreState } from './storeTypes';
import { createGroupSlice } from './slices/groupSlice';
import { createTaskSlice } from './slices/taskSlice';
import { createPersistenceSlice } from './slices/persistenceSlice';

// Re-export types and functions for backward compatibility
export type { Group, Priority, StoreTask, ArchiveTimeView };
export { parseTimeString, PRIORITY_COLORS };
export { useUIStore };
export type { StoreState as GroupStore }; // Re-export as GroupStore for compatibility

export const useGroupStore = create<StoreState>()((...a) => ({
  ...createGroupSlice(...a),
  ...createTaskSlice(...a),
  ...createPersistenceSlice(...a),
}));