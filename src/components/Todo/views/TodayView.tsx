import { useState, useMemo } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';
import { getTodayKey, formatDateKey } from '@/lib/date';
import { TaskListView } from './TaskListView';

/**
 * TodayView - Shows tasks scheduled for today.
 */
export function TodayView() {
    const { tasks } = useGroupStore();
    const { selectedColors } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTasks = useMemo(() => {
        const todayKey = getTodayKey();

        return tasks
            .filter(t => {
                if (t.parentId) return false;
                if (!selectedColors.includes(t.color || 'default')) return false;
                if (!t.startDate) return false;

                const taskDateKey = formatDateKey(new Date(t.startDate));
                if (taskDateKey !== todayKey) return false;

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
    }, [tasks, selectedColors, searchQuery]);

    return (
        <TaskListView
            title="Today"
            tasks={filteredTasks}
            allTasks={tasks}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showScheduledSection={false}
        />
    );
}
