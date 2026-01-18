import { useCallback } from 'react';
import type { Task } from '@/stores/types';
import { TaskItem } from '@/components/common/TaskList';

interface TaskSectionProps {
    tasks: Task[];
    allTasks: Task[];
    activeId: string | null;
    onToggle: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onAddSubTask: (parentId: string) => void;
    onToggleCollapse: (id: string) => void;
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
            .sort((a, b) => a.order - b.order);
    }, [allTasks]);

    const checkAncestorDragged = useCallback((taskId: string, visited = new Set<string>()): boolean => {
        if (taskId === activeId) return true;
        if (visited.has(taskId)) return false;
        visited.add(taskId);
        const t = allTasks.find(item => item.id === taskId);
        if (t?.parentId) return checkAncestorDragged(t.parentId, visited);
        return false;
    }, [activeId, allTasks]);

    const renderTaskItem = useCallback((task: Task, level: number = 0): JSX.Element => {
        const children = getChildren(task.id);
        const hasChildren = children.length > 0;
        const isBeingDragged = checkAncestorDragged(task.id);

        return (
            <div key={task.id}>
                <TaskItem
                    task={task}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onAddSubTask={onAddSubTask}
                    isBeingDragged={isBeingDragged}
                    level={level}
                    hasChildren={hasChildren}
                    collapsed={task.collapsed}
                    onToggleCollapse={() => onToggleCollapse(task.id)}
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
