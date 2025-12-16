import { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import { StoreTask, Priority } from '../types';
import { parseTimeEstimation } from '../timeParser';
import { persistGroup, collectTaskAndDescendants, calculateActualTime } from '../taskUtils';
import { reorderTasksInGroup, crossStatusReorderTask, moveTaskBetweenGroups } from '../reorderUtils';
import { deleteCompletedTasksInGroup } from '../archiveUtils';
import { useUndoStore } from '../useUndoStore';
import { StoreState } from '../storeTypes';

export interface TaskSlice {
  tasks: StoreTask[];
  
  addTask: (content: string, groupId: string, priority?: Priority) => void;
  addSubTask: (parentId: string, content: string) => void;
  updateTask: (id: string, content: string) => void;
  updateTaskSchedule: (id: string, scheduledTime?: string) => void;
  updateTaskEstimation: (id: string, estimatedMinutes?: number) => void;
  updateTaskPriority: (id: string, priority: Priority) => void;
  toggleTask: (id: string, skipReorder?: boolean) => void;
  toggleCollapse: (id: string) => void;
  deleteTask: (id: string) => void;
  undoLastAction: () => void;
  deleteCompletedTasks: (groupId: string) => void;
  reorderTasks: (activeId: string, overId: string) => void;
  crossStatusReorder: (activeId: string, overId: string) => void;
  moveTaskToGroup: (taskId: string, targetGroupId: string, overTaskId?: string | null) => Promise<void>;
}

export const createTaskSlice: StateCreator<StoreState, [], [], TaskSlice> = (set, get) => ({
  tasks: [],

  addTask: (content, groupId, priority = 'default') => set((state) => {
    const groupTasks = state.tasks.filter(t => t.groupId === groupId && !t.parentId);
    const { cleanContent, estimatedMinutes } = parseTimeEstimation(content);
    
    const newTask: StoreTask = {
      id: nanoid(),
      content: cleanContent,
      completed: false,
      createdAt: Date.now(),
      order: groupTasks.length,
      groupId,
      parentId: null,
      collapsed: false,
      priority,
      estimatedMinutes,
    };
    
    const newTasks = [...state.tasks, newTask];
    persistGroup(state.groups, newTasks, groupId);
    return { tasks: newTasks };
  }),
  
  addSubTask: (parentId, content) => set((state) => {
    const parentTask = state.tasks.find(t => t.id === parentId);
    if (!parentTask) return state;
    
    const siblings = state.tasks.filter(t => t.parentId === parentId);
    const { cleanContent, estimatedMinutes } = parseTimeEstimation(content);
    
    const newTask: StoreTask = {
      id: nanoid(),
      content: cleanContent,
      completed: false,
      createdAt: Date.now(),
      order: siblings.length,
      groupId: parentTask.groupId,
      parentId: parentId,
      collapsed: false,
      estimatedMinutes,
    };
    
    const newTasks = [...state.tasks, newTask];
    persistGroup(state.groups, newTasks, parentTask.groupId);
    return { tasks: newTasks };
  }),
  
  updateTask: (id, content) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    const { cleanContent, estimatedMinutes } = parseTimeEstimation(content);
    
    task.content = cleanContent;
    
    if (estimatedMinutes !== undefined) {
      task.estimatedMinutes = estimatedMinutes;
    }
    
    persistGroup(state.groups, state.tasks, task.groupId);
    return { tasks: [...state.tasks] };
  }),

  updateTaskSchedule: (id, scheduledTime) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    task.scheduledTime = scheduledTime;
    
    persistGroup(state.groups, state.tasks, task.groupId);
    return { tasks: [...state.tasks] };
  }),
  
  updateTaskEstimation: (id, estimatedMinutes) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    task.estimatedMinutes = estimatedMinutes;
    
    persistGroup(state.groups, state.tasks, task.groupId);
    return { tasks: [...state.tasks] };
  }),
  
  updateTaskPriority: (id, priority) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    task.priority = priority;
    
    persistGroup(state.groups, state.tasks, task.groupId);
    return { tasks: [...state.tasks] };
  }),
  
  toggleTask: (id, skipReorder = false) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    const isCompleting = !task.completed;
    const now = Date.now();
    const actualMinutes = calculateActualTime(task.createdAt, isCompleting);
    
    let newTasks = state.tasks.map(t => {
      if (t.id !== id) return t;
      return { 
        ...t, 
        completed: isCompleting,
        completedAt: isCompleting ? now : undefined,
        actualMinutes,
      };
    });
    
    if (!skipReorder) {
      const groupTopLevelTasks = newTasks
        .filter(t => t.groupId === task.groupId && !t.parentId)
        .sort((a, b) => a.order - b.order);
      
      const incompleteTopLevel = groupTopLevelTasks.filter(t => !t.completed);
      const completedTopLevel = groupTopLevelTasks.filter(t => t.completed);
      
      const reorderedTopLevel = [...incompleteTopLevel, ...completedTopLevel];
      reorderedTopLevel.forEach((t, i) => t.order = i);
      
      const childTasks = newTasks.filter(t => t.groupId === task.groupId && t.parentId);
      const otherTasks = newTasks.filter(t => t.groupId !== task.groupId);
      newTasks = [...otherTasks, ...reorderedTopLevel, ...childTasks];
    }
    
    persistGroup(state.groups, newTasks, task.groupId);
    return { tasks: newTasks };
  }),
  
  toggleCollapse: (id) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    const newTasks = state.tasks.map(t => {
      if (t.id !== id) return t;
      return { ...t, collapsed: !t.collapsed };
    });
    persistGroup(state.groups, newTasks, task.groupId);
    return { tasks: newTasks };
  }),
  
  deleteTask: (id) => set((state) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return state;
    
    const tasksToDelete = collectTaskAndDescendants(task, state.tasks);
    const idsToDelete = new Set(tasksToDelete.map(t => t.id));
    
    useUndoStore.getState().pushUndo({
      type: 'delete-task',
      tasks: tasksToDelete.map(t => ({ ...t })),
      groupId: task.groupId,
    });
    
    const tasksWithoutDeleted = state.tasks.filter(t => !idsToDelete.has(t.id));
    
    const groupTasks = tasksWithoutDeleted.filter(t => t.groupId === task.groupId);
    
    const tasksByParent = new Map<string | null, StoreTask[]>();
    groupTasks.forEach(t => {
      const key = t.parentId || null;
      if (!tasksByParent.has(key)) {
        tasksByParent.set(key, []);
      }
      tasksByParent.get(key)!.push(t);
    });
    
    tasksByParent.forEach((levelTasks) => {
      levelTasks.sort((a, b) => a.order - b.order);
      levelTasks.forEach((t, i) => t.order = i);
    });
    
    const otherTasks = tasksWithoutDeleted.filter(t => t.groupId !== task.groupId);
    const newTasks = [...otherTasks, ...groupTasks];
    
    persistGroup(state.groups, newTasks, task.groupId);
    return { tasks: newTasks };
  }),
  
  undoLastAction: () => set((state) => {
    const action = useUndoStore.getState().popUndo();
    if (!action) return state;
    
    if (action.type === 'delete-task') {
      const newTasks = [...state.tasks, ...action.tasks];
      persistGroup(state.groups, newTasks, action.groupId);
      return { tasks: newTasks };
    }
    
    return state;
  }),
  
  deleteCompletedTasks: (groupId) => set((state) => {
    const result = deleteCompletedTasksInGroup(groupId, state.tasks, state.groups);
    return { tasks: result.newTasks };
  }),
  
  reorderTasks: (activeId, overId) => set((state) => {
    const result = reorderTasksInGroup(activeId, overId, state.tasks, state.groups);
    return result.success ? { tasks: result.newTasks } : state;
  }),
  
  crossStatusReorder: (activeId, overId) => set((state) => {
    const result = crossStatusReorderTask(activeId, overId, state.tasks, state.groups);
    return result.success ? { tasks: result.newTasks } : state;
  }),
  
  moveTaskToGroup: async (taskId, targetGroupId, overTaskId) => {
    const state = get();
    if (!state.loadedGroups.has(targetGroupId)) {
      console.log(`[MoveTask] Target group ${targetGroupId} not loaded, loading first...`);
      await state.loadGroupTasks(targetGroupId);
    }
    
    set((state) => {
      const result = moveTaskBetweenGroups(taskId, targetGroupId, overTaskId, state.tasks, state.groups);
      return result.success ? { tasks: result.newTasks, activeGroupId: targetGroupId } : state;
    });
  },
});
