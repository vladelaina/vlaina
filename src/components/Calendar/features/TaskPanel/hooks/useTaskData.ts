import { useMemo } from 'react';
import type { Task } from '@/stores/types';
import type { TaskStatus } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';

interface UseTaskDataProps {
    tasks: Task[];
    activeGroupId: string;
    selectedColors: string[];
    selectedStatuses: TaskStatus[];
    searchQuery: string;
    hideCompleted: boolean;
}

interface UseTaskDataResult {
    incompleteTasks: Task[];
    scheduledTasks: Task[];
    completedTasks: Task[];
    incompleteTaskIds: string[];
    scheduledTaskIds: string[];
    completedTaskIds: string[];
}

/**
 * Custom hook for filtering, sorting, and grouping tasks
 * Extracted from CalendarTaskPanel for better separation of concerns
 */
export function useTaskData({
    tasks,
    activeGroupId,
    selectedColors,
    selectedStatuses,
    searchQuery,
    hideCompleted,
}: UseTaskDataProps): UseTaskDataResult {
    // Filter and sort top-level tasks
    const { incompleteTasks, scheduledTasks, completedTasks } = useMemo(() => {
        const topLevelTasks = tasks
            .filter((t) => {
                if (t.groupId !== activeGroupId || t.parentId) return false;
                if (!selectedColors.includes(t.color || 'default')) return false;
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    if (!t.content.toLowerCase().includes(query)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const aColor = getColorPriority(a.color);
                const bColor = getColorPriority(b.color);
                if (aColor !== bColor) return aColor - bColor;
                return a.order - b.order;
            });

        const notCompleted = topLevelTasks.filter((t) => !t.completed);
        const scheduled = notCompleted.filter((t) => t.startDate);
        const unscheduled = notCompleted.filter((t) => !t.startDate);

        const showTodo = selectedStatuses.includes('todo' as TaskStatus);
        const showScheduled = selectedStatuses.includes('scheduled' as TaskStatus);
        const showCompleted = selectedStatuses.includes('completed' as TaskStatus);

        return {
            incompleteTasks: showTodo ? unscheduled : [],
            scheduledTasks: showScheduled ? scheduled : [],
            completedTasks: (hideCompleted || !showCompleted) ? [] : topLevelTasks.filter((t) => t.completed),
        };
    }, [tasks, activeGroupId, selectedColors, selectedStatuses, searchQuery, hideCompleted]);

    // Generate flattened task IDs including children (for DnD)
    const incompleteTaskIds = useMemo(() => {
        const ids: string[] = [];
        const addTaskAndChildren = (task: Task) => {
            ids.push(task.id);
            const children = tasks.filter(t => t.parentId === task.id);
            children.forEach(addTaskAndChildren);
        };
        incompleteTasks.forEach(addTaskAndChildren);
        return ids;
    }, [incompleteTasks, tasks]);

    const scheduledTaskIds = useMemo(() => {
        const ids: string[] = [];
        const addTaskAndChildren = (task: Task) => {
            ids.push(task.id);
            const children = tasks.filter(t => t.parentId === task.id);
            children.forEach(addTaskAndChildren);
        };
        scheduledTasks.forEach(addTaskAndChildren);
        return ids;
    }, [scheduledTasks, tasks]);

    const completedTaskIds = useMemo(() => {
        const ids: string[] = [];
        const addTaskAndChildren = (task: Task) => {
            ids.push(task.id);
            const children = tasks.filter(t => t.parentId === task.id);
            children.forEach(addTaskAndChildren);
        };
        completedTasks.forEach(addTaskAndChildren);
        return ids;
    }, [completedTasks, tasks]);

    return {
        incompleteTasks,
        scheduledTasks,
        completedTasks,
        incompleteTaskIds,
        scheduledTaskIds,
        completedTaskIds,
    };
}
