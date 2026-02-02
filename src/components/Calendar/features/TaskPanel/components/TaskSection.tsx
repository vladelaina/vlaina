import { useCallback } from 'react';
import type { NekoEvent } from '@/stores/types';
import { TaskItem } from '@/components/common/TaskList';

interface TaskSectionProps {
    tasks: NekoEvent[];
    allTasks: NekoEvent[];
    activeId: string | null;
    onToggle: (uid: string) => void;
    onUpdate: (uid: string, updates: Partial<NekoEvent>) => void;
    onDelete: (uid: string) => void;
    onAddSubTask: (parentId: string) => void;
    onToggleCollapse: (uid: string) => void;
}

export function TaskSection({
    tasks,
    allTasks,
    activeId,
    onToggle,
    onUpdate,
    onDelete,
    onAddSubTask,
    onToggleCollapse,
}: TaskSectionProps) {
    const getChildren = useCallback((parentId: string) => {
        return allTasks
            .filter(t => t.parentId === parentId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [allTasks]);

    const checkAncestorDragged = useCallback((taskId: string, visited = new Set<string>()): boolean => {
        if (taskId === activeId) return true;
        if (visited.has(taskId)) return false;
        visited.add(taskId);
        const t = allTasks.find(item => item.uid === taskId);
        if (t?.parentId) return checkAncestorDragged(t.parentId, visited);
        return false;
    }, [activeId, allTasks]);

    const renderTaskItem = useCallback((task: NekoEvent, level: number = 0) => {
        const children = getChildren(task.uid);
        const hasChildren = children.length > 0;
        const isBeingDragged = checkAncestorDragged(task.uid);

        return (
            <div key={task.uid}>
                <TaskItem
                    task={task}
                    onToggle={onToggle}
                    onUpdate={(uid, summary) => onUpdate(uid, { summary })}
                    onDelete={onDelete}
                    onAddSubTask={onAddSubTask}
                    isBeingDragged={isBeingDragged}
                    level={level}
                    hasChildren={hasChildren}
                    collapsed={task.collapsed}
                    onToggleCollapse={() => onToggleCollapse(task.uid)}
                />
                {hasChildren && !task.collapsed && (
                    <div className="ml-4">
                        {children.map(child => renderTaskItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    }, [getChildren, checkAncestorDragged, onToggle, onUpdate, onDelete, onAddSubTask, onToggleCollapse]);

    if (tasks.length === 0) return null;

    return (
        <div className="space-y-2">
            {tasks.map(task => renderTaskItem(task, 0))}
        </div>
    );
}
