import type { Task } from '@/stores/useGroupStore';
import type { TaskSortMode } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';

export function sortTasks(tasks: Task[], mode: TaskSortMode): Task[] {
    const sorted = [...tasks];
    
    switch (mode) {
        case 'time':
            return sorted.sort((a, b) => b.createdAt - a.createdAt);
            
        case 'priority':
            return sorted.sort((a, b) => {
                const aPriority = getColorPriority(a.color);
                const bPriority = getColorPriority(b.color);
                if (aPriority !== bPriority) return aPriority - bPriority;
                return a.order - b.order;
            });
            
        case 'default':
        default:
            return sorted.sort((a, b) => a.order - b.order);
    }
}