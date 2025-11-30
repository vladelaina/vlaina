import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { loadGroups, saveGroup, deleteGroup as deleteGroupFile, type GroupData } from '@/lib/storage';

// Note: This store uses 'StoreTask' with 'completed' field for persistence.
// Components using types/index.ts 'Task' interface should map 'completed' <-> 'isDone'

export interface Group {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  pinned?: boolean;
}

// Internal Task type for persistence (uses 'completed')
export interface StoreTask {
  id: string;
  content: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  scheduledTime?: string;
  order: number;
  groupId: string;
  
  // Hierarchical structure (nested tasks)
  parentId: string | null;  // Parent task ID, null for top-level
  collapsed: boolean;       // Whether children are hidden
}

interface GroupStore {
  groups: Group[];
  tasks: StoreTask[];
  activeGroupId: string | null;
  drawerOpen: boolean;
  loaded: boolean;
  hideCompleted: boolean;
  
  // Drag state for cross-group drag
  draggingTaskId: string | null;
  setDraggingTaskId: (id: string | null) => void;
  setHideCompleted: (hide: boolean) => void;
  
  loadData: () => Promise<void>;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  setActiveGroup: (id: string | null) => void;
  addGroup: (name: string) => void;
  updateGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  togglePin: (id: string) => void;
  reorderGroups: (activeId: string, overId: string) => void;
  
  // Task operations
  addTask: (content: string, groupId: string) => void;
  addSubTask: (parentId: string, content: string) => void;
  updateTask: (id: string, content: string) => void;
  toggleTask: (id: string) => void;
  toggleCollapse: (id: string) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (activeId: string, overId: string) => void;
  moveTaskToGroup: (taskId: string, targetGroupId: string, overTaskId?: string | null) => void;
}

// 保存分组到文件
async function persistGroup(groups: Group[], tasks: StoreTask[], groupId: string) {
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  
  const groupTasks = tasks.filter(t => t.groupId === groupId);
  const groupData: GroupData = {
    id: group.id,
    name: group.name,
    pinned: group.pinned || false,
    tasks: groupTasks.map(t => ({
      id: t.id,
      content: t.content,
      completed: t.completed,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      scheduledTime: t.scheduledTime,
      order: t.order,
      parentId: t.parentId,
      collapsed: t.collapsed,
    })),
    createdAt: group.createdAt,
    updatedAt: Date.now(),
  };
  
  await saveGroup(groupData);
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],
  tasks: [],
  activeGroupId: 'default',
  drawerOpen: false,
  loaded: false,
  hideCompleted: false,
  draggingTaskId: null,
  
  setDraggingTaskId: (id) => set({ draggingTaskId: id }),
  setHideCompleted: (hide) => set({ hideCompleted: hide }),

  loadData: async () => {
    if (get().loaded) return;
    
    const groupsData = await loadGroups();
    const groups: Group[] = [];
    const tasks: StoreTask[] = [];
    
    for (const gd of groupsData) {
      groups.push({
        id: gd.id,
        name: gd.name,
        pinned: gd.pinned,
        createdAt: gd.createdAt,
      });
      
      for (const td of gd.tasks) {
        tasks.push({
          id: td.id,
          content: td.content,
          completed: td.completed,
          createdAt: td.createdAt,
          completedAt: td.completedAt,
          scheduledTime: td.scheduledTime,
          order: td.order,
          groupId: gd.id,
          parentId: (td as any).parentId || null,
          collapsed: (td as any).collapsed || false,
        });
      }
    }
    
    // 按置顶排序
    groups.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
    
    set({ groups, tasks, loaded: true });
  },

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  
  setActiveGroup: (id) => set({ activeGroupId: id }),
  
  addGroup: (name) => {
    const newGroup: Group = {
      id: nanoid(),
      name,
      createdAt: Date.now(),
    };
    
    set((state) => {
      const newGroups = [...state.groups, newGroup];
      persistGroup(newGroups, state.tasks, newGroup.id);
      return { groups: newGroups };
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
    return {
      groups: state.groups.filter((g) => g.id !== id),
      tasks: state.tasks.filter((t) => t.groupId !== id),
      activeGroupId: state.activeGroupId === id ? 'default' : state.activeGroupId,
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
  
  // 任务操作
  addTask: (content, groupId) => set((state) => {
    const groupTasks = state.tasks.filter(t => t.groupId === groupId && !t.parentId);
    const newTask: StoreTask = {
      id: nanoid(),
      content,
      completed: false,
      createdAt: Date.now(),
      order: groupTasks.length,
      groupId,
      parentId: null,
      collapsed: false,
    };
    
    const newTasks = [...state.tasks, newTask];
    persistGroup(state.groups, newTasks, groupId);
    return { tasks: newTasks };
  }),
  
  addSubTask: (parentId, content) => set((state) => {
    const parentTask = state.tasks.find(t => t.id === parentId);
    if (!parentTask) return state;
    
    const siblings = state.tasks.filter(t => t.parentId === parentId);
    const newTask: StoreTask = {
      id: nanoid(),
      content,
      completed: false,
      createdAt: Date.now(),
      order: siblings.length,
      groupId: parentTask.groupId,
      parentId: parentId,
      collapsed: false,
    };
    
    const newTasks = [...state.tasks, newTask];
    persistGroup(state.groups, newTasks, parentTask.groupId);
    return { tasks: newTasks };
  }),
  
  updateTask: (id, content) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    const newTasks = state.tasks.map(t =>
      t.id === id ? { ...t, content } : t
    );
    persistGroup(state.groups, newTasks, task.groupId);
    return { tasks: newTasks };
  }),
  
  toggleTask: (id) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    const isCompleting = !task.completed;
    
    // Update the task's completed status
    let newTasks = state.tasks.map(t =>
      t.id === id ? { 
        ...t, 
        completed: isCompleting,
        completedAt: isCompleting ? Date.now() : undefined,
      } : t
    );
    
    // Only reorder top-level tasks by completion status (preserve hierarchy)
    const groupTopLevelTasks = newTasks
      .filter(t => t.groupId === task.groupId && !t.parentId)
      .sort((a, b) => a.order - b.order);
    
    const incompleteTopLevel = groupTopLevelTasks.filter(t => !t.completed);
    const completedTopLevel = groupTopLevelTasks.filter(t => t.completed);
    
    // Reorder top-level: incomplete first, then completed
    const reorderedTopLevel = [...incompleteTopLevel, ...completedTopLevel];
    reorderedTopLevel.forEach((t, i) => t.order = i);
    
    // Update newTasks: replace top-level tasks with reordered version
    const childTasks = newTasks.filter(t => t.groupId === task.groupId && t.parentId);
    const otherTasks = newTasks.filter(t => t.groupId !== task.groupId);
    newTasks = [...otherTasks, ...reorderedTopLevel, ...childTasks];
    
    persistGroup(state.groups, newTasks, task.groupId);
    return { tasks: newTasks };
  }),
  
  toggleCollapse: (id) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    const newTasks = state.tasks.map(t =>
      t.id === id ? { ...t, collapsed: !t.collapsed } : t
    );
    persistGroup(state.groups, newTasks, task.groupId);
    return { tasks: newTasks };
  }),
  
  deleteTask: (id) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    // Recursively collect all task IDs to delete (task + all descendants)
    const idsToDelete = new Set<string>([id]);
    const collectDescendants = (parentId: string) => {
      const children = state.tasks.filter(t => t.parentId === parentId);
      children.forEach(child => {
        idsToDelete.add(child.id);
        collectDescendants(child.id);
      });
    };
    collectDescendants(id);
    
    // Remove the task and all its descendants
    const tasksWithoutDeleted = state.tasks.filter(t => !idsToDelete.has(t.id));
    
    // Reorder tasks within each level separately
    const groupTasks = tasksWithoutDeleted.filter(t => t.groupId === task.groupId);
    
    // Group by parentId and reorder each level
    const tasksByParent = new Map<string | null, StoreTask[]>();
    groupTasks.forEach(t => {
      const key = t.parentId || null;
      if (!tasksByParent.has(key)) {
        tasksByParent.set(key, []);
      }
      tasksByParent.get(key)!.push(t);
    });
    
    // Reorder each level
    tasksByParent.forEach((levelTasks) => {
      levelTasks.sort((a, b) => a.order - b.order);
      levelTasks.forEach((t, i) => t.order = i);
    });
    
    // Combine with other groups
    const otherTasks = tasksWithoutDeleted.filter(t => t.groupId !== task.groupId);
    const newTasks = [...otherTasks, ...groupTasks];
    
    persistGroup(state.groups, newTasks, task.groupId);
    return { tasks: newTasks };
  }),
  
  reorderTasks: (activeId, overId) => set((state) => {
    const activeTask = state.tasks.find(t => t.id === activeId);
    const overTask = state.tasks.find(t => t.id === overId);
    if (!activeTask || !overTask) return state;
    
    // Safety check: ensure both tasks are at the same level
    if (activeTask.parentId !== overTask.parentId) {
      console.warn('Cannot reorder tasks from different levels');
      return state;
    }
    
    // Only reorder within the same parent level
    const sameLevelTasks = state.tasks
      .filter(t => t.groupId === activeTask.groupId && t.parentId === activeTask.parentId)
      .sort((a, b) => a.order - b.order);
    
    const oldIndex = sameLevelTasks.findIndex(t => t.id === activeId);
    const newIndex = sameLevelTasks.findIndex(t => t.id === overId);
    
    if (oldIndex === -1 || newIndex === -1) return state;
    
    const reordered = [...sameLevelTasks];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);
    
    // Update order for this level only
    reordered.forEach((t, i) => t.order = i);
    
    // Combine with other tasks
    const otherTasks = state.tasks.filter(
      t => t.groupId !== activeTask.groupId || t.parentId !== activeTask.parentId
    );
    const newTasks = [...otherTasks, ...reordered];
    
    persistGroup(state.groups, newTasks, activeTask.groupId);
    return { tasks: newTasks };
  }),
  
  moveTaskToGroup: (taskId, targetGroupId, overTaskId) => set((state) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || task.groupId === targetGroupId) return state;
    
    const oldGroupId = task.groupId;
    
    // Collect task and all its descendants
    const tasksToMove: StoreTask[] = [];
    const collectTaskAndDescendants = (parentTask: StoreTask) => {
      tasksToMove.push(parentTask);
      const children = state.tasks.filter(t => t.parentId === parentTask.id);
      children.forEach(child => collectTaskAndDescendants(child));
    };
    collectTaskAndDescendants(task);
    
    // Update groupId for all collected tasks
    const movedTasks = tasksToMove.map(t => ({ ...t, groupId: targetGroupId }));
    
    // Get target group TOP-LEVEL tasks only (excluding tasks being moved)
    const targetGroupTasks = state.tasks
      .filter(t => t.groupId === targetGroupId && !t.parentId && !tasksToMove.some(mt => mt.id === t.id))
      .sort((a, b) => a.order - b.order);
    
    // Determine the insert index (only insert the parent task)
    let insertIndex: number;
    if (overTaskId) {
      const overIndex = targetGroupTasks.findIndex(t => t.id === overTaskId);
      insertIndex = overIndex !== -1 ? overIndex : targetGroupTasks.length;
    } else {
      insertIndex = targetGroupTasks.length;
    }
    
    // Insert only the parent task at the target position
    targetGroupTasks.splice(insertIndex, 0, movedTasks[0]);
    
    // Reassign order for target group TOP-LEVEL tasks
    targetGroupTasks.forEach((t, i) => t.order = i);
    
    // Get old group TOP-LEVEL tasks (excluding moved tasks) and reassign order
    const oldGroupTasks = state.tasks
      .filter(t => t.groupId === oldGroupId && !t.parentId && !tasksToMove.some(mt => mt.id === t.id))
      .sort((a, b) => a.order - b.order);
    oldGroupTasks.forEach((t, i) => t.order = i);
    
    // Get child tasks from the moved tasks and preserve their order relative to parent
    const movedChildTasks = movedTasks.slice(1);
    
    // Combine: other groups + old group + target group + moved children
    const otherTasks = state.tasks.filter(
      t => t.groupId !== oldGroupId && t.groupId !== targetGroupId && !tasksToMove.some(mt => mt.id === t.id)
    );
    const newTasks = [...otherTasks, ...oldGroupTasks, ...targetGroupTasks, ...movedChildTasks];
    
    // Persist both groups
    persistGroup(state.groups, newTasks, oldGroupId);
    persistGroup(state.groups, newTasks, targetGroupId);
    
    return { tasks: newTasks, activeGroupId: targetGroupId };
  }),
}));
