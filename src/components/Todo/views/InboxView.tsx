import { useState, useMemo } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';
import { DEFAULT_GROUP_ID } from '@/lib/config';
import { TaskListView } from './TaskListView';

/**
 * InboxView - Shows tasks in the default 'Inbox' group.
 */
export function InboxView() {
    const { tasks } = useGroupStore();
    const { selectedColors } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTasks = useMemo(() => {
        return tasks
            .filter(t => {
                if (t.parentId) return false;
                if (t.groupId !== DEFAULT_GROUP_ID) return false;
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
    }, [tasks, selectedColors, searchQuery]);

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
