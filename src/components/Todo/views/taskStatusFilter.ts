import type { NekoEvent } from '@/lib/ics/types';
import type { TaskStatus } from '@/stores/uiSlice';

export function matchesSelectedStatus(task: NekoEvent, selectedStatuses: TaskStatus[]): boolean {
    if (task.completed) return selectedStatuses.includes('completed');
    if (task.dtstart) return selectedStatuses.includes('scheduled');
    return selectedStatuses.includes('todo');
}
