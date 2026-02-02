import type { NekoEvent } from './types';
import { collectTaskAndDescendants } from './taskUtils';

export function reorderTasksInGroup(
  activeId: string,
  overId: string,
  tasks: NekoEvent[]
): { success: boolean; newTasks: NekoEvent[] } {
  const activeTask = tasks.find(t => t.uid === activeId);
  const overTask = tasks.find(t => t.uid === overId);
  if (!activeTask || !overTask) {
    return { success: false, newTasks: tasks };
  }
  
  let newTasks = [...tasks];
  
  if (activeTask.parentId !== overTask.parentId) {
    newTasks = newTasks.map(t => {
      if (t.uid !== activeId) return t;
      return { ...t, parentId: overTask.parentId };
    });
  }
  
  const updatedActiveTask = newTasks.find(t => t.uid === activeId)!;
  
  const sameLevelTasks = newTasks
    .filter(t => t.calendarId === updatedActiveTask.calendarId && t.parentId === updatedActiveTask.parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  const oldIndex = sameLevelTasks.findIndex(t => t.uid === activeId);
  const newIndex = sameLevelTasks.findIndex(t => t.uid === overId);
  
  if (oldIndex === -1 || newIndex === -1) {
    return { success: false, newTasks: tasks };
  }
  
  const reordered = [...sameLevelTasks];
  const [removed] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, removed);
  
  reordered.forEach((t, i) => {
    const task = newTasks.find(nt => nt.uid === t.uid);
    if (task) task.order = i;
  });
  
  if (activeTask.parentId !== updatedActiveTask.parentId) {
    const oldLevelTasks = newTasks
      .filter(t => t.calendarId === activeTask.calendarId && t.parentId === activeTask.parentId && t.uid !== activeId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    oldLevelTasks.forEach((t, i) => {
      const task = newTasks.find(nt => nt.uid === t.uid);
      if (task) task.order = i;
    });
  }
  
  const currentGroupTasks = newTasks.filter(t => t.calendarId === updatedActiveTask.calendarId);
  const otherGroupTasks = newTasks.filter(t => t.calendarId !== updatedActiveTask.calendarId);
  const finalTasks = [...otherGroupTasks, ...currentGroupTasks];
  
  return { success: true, newTasks: finalTasks };
}

export function crossStatusReorderTask(
  activeId: string,
  overId: string,
  tasks: NekoEvent[]
): { success: boolean; newTasks: NekoEvent[] } {
  const activeTask = tasks.find(t => t.uid === activeId);
  const overTask = tasks.find(t => t.uid === overId);
  
  if (!activeTask || !overTask) {
    return { success: false, newTasks: tasks };
  }
  if (activeTask.parentId !== overTask.parentId) {
    return { success: false, newTasks: tasks };
  }
  
  const newCompleted = overTask.completed;
  
  const newTasks = tasks.map(t => {
    if (t.uid === activeId) {
      return {
        ...t,
        completed: newCompleted,
      };
    }
    return t;
  });
  
  const sameLevelTasks = newTasks.filter(
    t => t.calendarId === activeTask.calendarId && t.parentId === activeTask.parentId
  );
  
  const incomplete = sameLevelTasks.filter(t => !t.completed);
  const completed = sameLevelTasks.filter(t => t.completed);
  
  const targetList = newCompleted ? completed : incomplete;
  const sortedTarget = targetList.sort((a, b) => (a.order || 0) - (b.order || 0));
  
  const overIndexInFull = sortedTarget.findIndex(t => t.uid === overId);
  const withoutActive = sortedTarget.filter(t => t.uid !== activeId);
  
  let insertIndex = overIndexInFull;
  if (overIndexInFull === -1) {
    insertIndex = withoutActive.length;
  } else {
    const activeIndexInTarget = sortedTarget.findIndex(t => t.uid === activeId);
    if (activeIndexInTarget !== -1 && activeIndexInTarget < overIndexInFull) {
      insertIndex = overIndexInFull - 1;
    } else {
      insertIndex = overIndexInFull;
    }
  }
  
  withoutActive.splice(insertIndex, 0, newTasks.find(t => t.uid === activeId)!);
  
  withoutActive.forEach((t, i) => {
    const task = newTasks.find(nt => nt.uid === t.uid);
    if (task) task.order = i;
  });
  
  const otherList = newCompleted ? incomplete : completed;
  otherList.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach((t, i) => {
    const task = newTasks.find(nt => nt.uid === t.uid);
    if (task) task.order = i;
  });
  
  return { success: true, newTasks };
}

export function moveTaskBetweenGroups(
  taskId: string,
  targetGroupId: string,
  overTaskId: string | null | undefined,
  tasks: NekoEvent[]
): { success: boolean; newTasks: NekoEvent[] } {
  const task = tasks.find(t => t.uid === taskId);
  if (!task || task.calendarId === targetGroupId) {
    return { success: false, newTasks: tasks };
  }
  
  const oldGroupId = task.calendarId;
  const tasksToMove = collectTaskAndDescendants(task, tasks);
  
  const movedTasks: NekoEvent[] = tasksToMove.map(t => ({ ...t, calendarId: targetGroupId }));
  
  const targetGroupTasks = tasks
    .filter(t => t.calendarId === targetGroupId && !t.parentId && !tasksToMove.some(mt => mt.uid === t.uid))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  let insertIndex: number;
  if (overTaskId) {
    const overIndex = targetGroupTasks.findIndex(t => t.uid === overTaskId);
    insertIndex = overIndex !== -1 ? overIndex : targetGroupTasks.length;
  } else {
    insertIndex = targetGroupTasks.length;
  }
  
  targetGroupTasks.splice(insertIndex, 0, movedTasks[0]);
  targetGroupTasks.forEach((t, i) => t.order = i);
  
  const oldGroupTasks = tasks
    .filter(t => t.calendarId === oldGroupId && !t.parentId && !tasksToMove.some(mt => mt.uid === t.uid))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  oldGroupTasks.forEach((t, i) => t.order = i);
  
  const movedChildTasks = movedTasks.slice(1);
  
  const otherTasks = tasks.filter(
    t => t.calendarId !== oldGroupId && t.calendarId !== targetGroupId && !tasksToMove.some(mt => mt.uid === t.uid)
  );
  const newTasks = [...otherTasks, ...oldGroupTasks, ...targetGroupTasks, ...movedChildTasks];
  
  return { success: true, newTasks };
}
