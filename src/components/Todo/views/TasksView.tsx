import { useState, useMemo } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import { sortTasks } from '@/components/common/TaskList';
import { TaskListView } from './TaskListView';
import { matchesSelectedStatus } from './taskStatusFilter';

export function TasksView() {
    const { tasks } = useGroupStore();
    const { selectedColors, selectedStatuses, taskSortMode } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTasks = useMemo(() => {
        const filtered = tasks
            .filter(t => {
                if (t.parentId) return false;
                if (!matchesSelectedStatus(t, selectedStatuses)) return false;
                if (!selectedColors.includes(t.color || 'default')) return false;
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    if (!t.summary.toLowerCase().includes(query)) return false;
                }
                return true;
            });
            
        return sortTasks(filtered, taskSortMode);
    }, [tasks, selectedColors, selectedStatuses, searchQuery, taskSortMode]);

    return (
        <TaskListView
            title="Tasks"
            tasks={filteredTasks}
            allTasks={tasks}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showScheduledSection={true}
        />
    );
}
