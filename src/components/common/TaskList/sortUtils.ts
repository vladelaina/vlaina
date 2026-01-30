import type { Task } from '@/stores/useGroupStore';
import type { TaskSortMode } from '@/stores/uiSlice';
import { getColorPriority } from '@/lib/colors';

export function sortTasks(tasks: Task[], mode: TaskSortMode): Task[] {
    // Create a shallow copy to avoid mutating the original array reference during sort
    // though .filter() usually creates a new array, it's safer.
    const sorted = [...tasks];
    
    switch (mode) {
        case 'time':
            // Sort by creation time descending (newest first)
            // If tasks have startDate, maybe prioritize that?
            // For now, simple createdAt descending.
            return sorted.sort((a, b) => b.createdAt - a.createdAt);
            
        case 'priority':
            // Sort by Color Priority (0=Red=High -> 7=Default=Low)
            return sorted.sort((a, b) => {
                const aPriority = getColorPriority(a.color);
                const bPriority = getColorPriority(b.color);
                if (aPriority !== bPriority) return aPriority - bPriority;
                
                // Secondary sort by order or createdAt
                return a.order - b.order;
            });
            
        case 'default':
        default:
            // Sort by manual order (ascending)
            return sorted.sort((a, b) => a.order - b.order);
    }
}