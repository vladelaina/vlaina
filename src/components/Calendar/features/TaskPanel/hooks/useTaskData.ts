import { useMemo } from 'react';
import type { NekoEvent } from '@/stores/types';
import type { TaskStatus } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';

interface UseTaskDataProps {
    tasks: NekoEvent[];
    activeGroupId: string;
    selectedColors: string[];
    selectedStatuses: TaskStatus[];
    searchQuery: string;
    hideCompleted: boolean;
}

interface UseTaskDataResult {
    incompleteTasks: NekoEvent[];
    scheduledTasks: NekoEvent[];
    completedTasks: NekoEvent[];
    incompleteTaskIds: string[];
    scheduledTaskIds: string[];
    completedTaskIds: string[];
}

export function useTaskData({
    tasks,
    activeGroupId,
    selectedColors,
    selectedStatuses,
    searchQuery,
    hideCompleted,
}: UseTaskDataProps): UseTaskDataResult {
    const { incompleteTasks, scheduledTasks, completedTasks } = useMemo(() => {
        const topLevelTasks = tasks
            .filter((t) => {
                if (t.calendarId !== activeGroupId || t.parentId) return false;
                if (!selectedColors.includes(t.color || 'default')) return false;
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    if (!t.summary.toLowerCase().includes(query)) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const aColor = getColorPriority(a.color);
                const bColor = getColorPriority(b.color);
                if (aColor !== bColor) return aColor - bColor;
                return (a.order || 0) - (b.order || 0);
            });

        const notCompleted = topLevelTasks.filter((t) => !t.completed);
        const startDates = notCompleted.map(t => t.dtstart ? new Date(t.dtstart).getTime() : null);
        const scheduled = notCompleted.filter((_t, i) => startDates[i] !== null);
        const unscheduled = notCompleted.filter((_t, i) => startDates[i] === null);

        const showTodo = selectedStatuses.includes('todo' as TaskStatus);
        const showScheduled = selectedStatuses.includes('scheduled' as TaskStatus);
        const showCompleted = selectedStatuses.includes('completed' as TaskStatus);

        return {
            incompleteTasks: showTodo ? unscheduled : [],
            scheduledTasks: showScheduled ? scheduled : [],
            completedTasks: (hideCompleted || !showCompleted) ? [] : topLevelTasks.filter((t) => t.completed),
        };
    }, [tasks, activeGroupId, selectedColors, selectedStatuses, searchQuery, hideCompleted]);

    const incompleteTaskIds = useMemo(() => {
        const ids: string[] = [];
        const addTaskAndChildren = (task: NekoEvent) => {
            ids.push(task.uid);
            const children = tasks.filter(t => t.parentId === task.uid);
            children.forEach(addTaskAndChildren);
        };
        incompleteTasks.forEach(addTaskAndChildren);
        return ids;
    }, [incompleteTasks, tasks]);

    const scheduledTaskIds = useMemo(() => {
        const ids: string[] = [];
        const addTaskAndChildren = (task: NekoEvent) => {
            ids.push(task.uid);
            const children = tasks.filter(t => t.parentId === task.uid);
            children.forEach(addTaskAndChildren);
        };
        scheduledTasks.forEach(addTaskAndChildren);
        return ids;
    }, [scheduledTasks, tasks]);

    const completedTaskIds = useMemo(() => {
        const ids: string[] = [];
        const addTaskAndChildren = (task: NekoEvent) => {
            ids.push(task.uid);
            const children = tasks.filter(t => t.parentId === task.uid);
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
