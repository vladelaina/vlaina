import { useMemo } from 'react';
import type { NekoEvent } from '@/stores/types';
import { getColorPriority } from '@/lib/colors';

interface UseTaskDataProps {
    tasks: NekoEvent[];
    activeGroupId: string;
    selectedColors: string[];
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
        const scheduled = notCompleted.filter((t) => t.scheduled !== false);
        const unscheduled = notCompleted.filter((t) => t.scheduled === false);

        return {
            incompleteTasks: unscheduled,
            scheduledTasks: scheduled,
            completedTasks: hideCompleted ? [] : topLevelTasks.filter((t) => t.completed),
        };
    }, [tasks, activeGroupId, selectedColors, searchQuery, hideCompleted]);

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
