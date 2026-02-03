import type { NekoEvent } from '@/lib/ics/types';

export function getDescendantIds(tasks: NekoEvent[], rootId: string): string[] {
    const children = tasks.filter(t => t.parentId === rootId);
    return [rootId, ...children.flatMap(child => getDescendantIds(tasks, child.uid))];
}

export function getChildren(tasks: NekoEvent[], parentId: string | null, groupId?: string): NekoEvent[] {
    return tasks
        .filter(t => {
            if (parentId === null && t.parentId !== undefined) return false;
            if (parentId !== null && t.parentId !== parentId) return false;
            if (groupId && t.groupId !== groupId) return false;
            return true;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function reorderSiblings(siblings: NekoEvent[], oldIndex: number, newIndex: number): NekoEvent[] {
    const newSiblings = [...siblings];
    const [removed] = newSiblings.splice(oldIndex, 1);
    newSiblings.splice(newIndex, 0, removed);
    
    return newSiblings.map((t, index) => ({
        ...t,
        order: index
    }));
}

export function isDescendant(tasks: NekoEvent[], parentId: string, childId: string): boolean {
    const child = tasks.find(t => t.uid === childId);
    if (!child || !child.parentId) return false;
    if (child.parentId === parentId) return true;
    return isDescendant(tasks, parentId, child.parentId);
}
