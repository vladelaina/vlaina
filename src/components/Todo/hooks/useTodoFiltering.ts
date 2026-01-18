import { useMemo } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';

interface UseTodoFilteringProps {
    searchQuery: string;
    scheduledExpanded: boolean;
    completedExpanded: boolean;
}

export function useTodoFiltering({ 
    searchQuery, 
    scheduledExpanded, 
    completedExpanded 
}: UseTodoFilteringProps) {
    const {
        tasks,
        activeGroupId,
    } = useGroupStore();

    const {
        hideCompleted,
        selectedColors,
    } = useUIStore();

    // 1. Data Processing Logic
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
        const completed = hideCompleted ? [] : topLevelTasks.filter((t) => t.completed);

        return {
            incompleteTasks: unscheduled,
            scheduledTasks: scheduled,
            completedTasks: completed,
        };
    }, [tasks, activeGroupId, hideCompleted, selectedColors, searchQuery]);

    // 2. Helper to get all IDs recursively for Drag and Drop Context
    const allSortableIds = useMemo(() => {
        const SCHEDULED_DIVIDER_ID = '__divider_scheduled__';
        const COMPLETED_DIVIDER_ID = '__divider_completed__';

        const getTaskAndChildrenIds = (taskList: typeof tasks) => {
            const ids: string[] = [];
            const traverse = (task: typeof tasks[0]) => {
                ids.push(task.id);
                const children = tasks.filter(t => t.parentId === task.id);
                children.forEach(traverse);
            };
            taskList.forEach(traverse);
            return ids;
        };

        const ids: string[] = [...getTaskAndChildrenIds(incompleteTasks)];

        if (scheduledTasks.length > 0) {
            ids.push(SCHEDULED_DIVIDER_ID);
            if (scheduledExpanded) {
                ids.push(...getTaskAndChildrenIds(scheduledTasks));
            }
        }

        if (completedTasks.length > 0) {
            ids.push(COMPLETED_DIVIDER_ID);
            if (completedExpanded) {
                ids.push(...getTaskAndChildrenIds(completedTasks));
            }
        }

        return ids;
    }, [incompleteTasks, scheduledTasks, completedTasks, scheduledExpanded, completedExpanded, tasks]);
    
    // 3. Helper to get children (Memoized to prevent render loops if passed down)
    const getChildren = (parentId: string) => {
        return tasks
            .filter(t => t.parentId === parentId && t.groupId === activeGroupId)
            .sort((a, b) => a.order - b.order);
    };

    return {
        incompleteTasks,
        scheduledTasks,
        completedTasks,
        allSortableIds,
        getChildren
    };
}