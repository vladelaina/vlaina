import { useGroupStore } from '@/stores/useGroupStore';
import { DEFAULT_GROUP_ID } from '@/lib/config';

import { TasksView, TodayView, InboxView, ProgressView, CompletedView } from './views';

export function TodoPanel() {
    const { activeGroupId } = useGroupStore();

    switch (activeGroupId) {
        case 'progress':
            return <ProgressView />;
        case 'today':
            return <TodayView />;
        case 'completed':
            return <CompletedView />;
        case 'all':
            return <TasksView />;
        case DEFAULT_GROUP_ID:
        default:
            return <InboxView />;
    }
}
