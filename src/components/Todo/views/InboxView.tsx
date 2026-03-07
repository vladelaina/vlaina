import { useState, useMemo } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import { sortTasks } from '@/components/common/TaskList';
import { DEFAULT_GROUP_ID } from '@/lib/config';
import { matchesSelectedTag } from '@/lib/tags/tagUtils';
import { TaskListView } from './TaskListView';

export function InboxView() {
    const { tasks } = useGroupStore();
    const { selectedColors, selectedTag, taskSortMode } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTasks = useMemo(() => {
        const filtered = tasks
            .filter(t => {
                if (t.parentId) return false;
                if ((t.groupId || DEFAULT_GROUP_ID) !== DEFAULT_GROUP_ID) return false;
                if (!matchesSelectedTag(t, selectedTag)) return false;
                if (!selectedColors.includes(t.color || 'default')) return false;
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    if (!t.summary.toLowerCase().includes(query)) return false;
                }
                return true;
            });
        
        return sortTasks(filtered, taskSortMode);
    }, [tasks, selectedColors, selectedTag, searchQuery, taskSortMode]);

    return (
        <TaskListView
            tasks={filteredTasks}
            allTasks={tasks}
            completionMode="active"
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
        />
    );
}
