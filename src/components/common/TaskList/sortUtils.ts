import type { NekoEvent } from '@/stores/types';
import type { TaskSortMode } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';

export function sortTasks(tasks: NekoEvent[], mode: TaskSortMode): NekoEvent[] {
    const sorted = [...tasks];
    
    switch (mode) {
        case 'time':
            return sorted.sort((a, b) => {
                const aTime = a.dtstart ? new Date(a.dtstart).getTime() : 0;
                const bTime = b.dtstart ? new Date(b.dtstart).getTime() : 0;
                return bTime - aTime;
            });
            
        case 'priority':
            return sorted.sort((a, b) => {
                const aPriority = getColorPriority(a.color);
                const bPriority = getColorPriority(b.color);
                if (aPriority !== bPriority) return aPriority - bPriority;
                return (a.order || 0) - (b.order || 0);
            });
            
        case 'default':
        default:
            return sorted.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
}