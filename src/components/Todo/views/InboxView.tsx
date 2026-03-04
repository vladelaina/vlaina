import { useState, useMemo } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import { sortTasks } from '@/components/common/TaskList';
import { DEFAULT_GROUP_ID } from '@/lib/config';
import { matchesSelectedTag } from '@/lib/tags/tagUtils';
import { TaskListView } from './TaskListView';
import { matchesSelectedStatus } from './taskStatusFilter';

export function InboxView() {
    const { tasks } = useGroupStore();
    const { selectedColors, selectedStatuses, selectedTag, taskSortMode } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTasks = useMemo(() => {
        const filtered = tasks
            .filter(t => {
                if (t.parentId) return false;
                if ((t.groupId || DEFAULT_GROUP_ID) !== DEFAULT_GROUP_ID) return false;
                if (!matchesSelectedStatus(t, selectedStatuses)) return false;
                if (!matchesSelectedTag(t, selectedTag)) return false;
                if (!selectedColors.includes(t.color || 'default')) return false;
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    if (!t.summary.toLowerCase().includes(query)) return false;
                }
                return true;
            });
        
        return sortTasks(filtered, taskSortMode);
    }, [tasks, selectedColors, selectedStatuses, selectedTag, searchQuery, taskSortMode]);

    return (
        <TaskListView
            title="Inbox"
            tasks={filteredTasks}
            allTasks={tasks}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showScheduledSection={true}
        />
    );
}
