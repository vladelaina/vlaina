import { useEffect } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { DEFAULT_GROUP_ID } from '@/lib/config';

import { TasksView, InboxView, ProgressView, CompletedView } from './views';

export function TodoPanel() {
    const { activeGroupId, setActiveGroup } = useGroupStore();

    useEffect(() => {
        if (activeGroupId === 'today') {
            setActiveGroup('all');
        }
    }, [activeGroupId, setActiveGroup]);

    switch (activeGroupId) {
        case 'progress':
            return <ProgressView />;
        case 'completed':
            return <CompletedView />;
        case 'all':
            return <TasksView />;
        case DEFAULT_GROUP_ID:
        default:
            return <InboxView />;
    }
}
