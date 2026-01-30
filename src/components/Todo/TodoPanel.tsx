import { useGroupStore } from '@/stores/useGroupStore';
import { DEFAULT_GROUP_ID } from '@/lib/config';

import { TasksView, TodayView, InboxView, ProgressView } from './views';

/**
 * TodoPanel - Router component that renders the appropriate view
 * based on the activeGroupId from the store.
 */
export function TodoPanel() {
    const { activeGroupId } = useGroupStore();

    switch (activeGroupId) {
        case 'progress':
            return <ProgressView />;
        case 'today':
            return <TodayView />;
        case 'all':
            return <TasksView />;
        case DEFAULT_GROUP_ID:
        default:
            return <InboxView />;
    }
}