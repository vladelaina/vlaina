import type { UnifiedTask } from '@/lib/storage/unifiedStorage';

/**
 * Task Tree Utilities
 * Helper functions for traversing and manipulating the flat task list as a tree.
 */

// Collects a task ID and all its descendant IDs recursively
export function getDescendantIds(tasks: UnifiedTask[], rootId: string): string[] {
    const children = tasks.filter(t => t.parentId === rootId);
    return [rootId, ...children.flatMap(child => getDescendantIds(tasks, child.id))];
}

// Gets immediate children sorted by order
export function getChildren(tasks: UnifiedTask[], parentId: string | null, groupId?: string): UnifiedTask[] {
    return tasks
        .filter(t => {
            if (t.parentId !== parentId) return false;
            if (groupId && t.groupId !== groupId) return false;
            return true;
        })
        .sort((a, b) => a.order - b.order);
}

// Reorders a list of siblings and returns the updated task objects with new order
export function reorderSiblings(siblings: UnifiedTask[], oldIndex: number, newIndex: number): UnifiedTask[] {
    const newSiblings = [...siblings];
    const [removed] = newSiblings.splice(oldIndex, 1);
    newSiblings.splice(newIndex, 0, removed);
    
    return newSiblings.map((t, index) => ({
        ...t,
        order: index
    }));
}

// Checks if a task is a descendant of another
export function isDescendant(tasks: UnifiedTask[], parentId: string, childId: string): boolean {
    const child = tasks.find(t => t.id === childId);
    if (!child || !child.parentId) return false;
    if (child.parentId === parentId) return true;
    return isDescendant(tasks, parentId, child.parentId);
}
