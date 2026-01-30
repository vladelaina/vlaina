import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
    DndContext, 
    DragOverlay, 
    type DragStartEvent
} from '@dnd-kit/core';
import type { Task } from '@/stores/useGroupStore';
import { useTaskDragAndDrop } from './useTaskDragAndDrop';
import { TaskItem } from './TaskItem';

interface TaskDragContextProps {
    children: React.ReactNode;
    allTasks: Task[];
    reorderTasks: (activeId: string, overId: string, makeChild?: boolean) => void;
    updateTaskTime: (taskId: string, startDate?: number | null, endDate?: number | null) => void;
    toggleTask: (taskId: string) => void;
    setDraggingTaskId: (id: string | null) => void;
    // Helper to get children count for the overlay item
    getChildCount?: (parentId: string) => number;
}

export function TaskDragContext({
    children,
    allTasks,
    reorderTasks,
    updateTaskTime,
    toggleTask,
    setDraggingTaskId,
    getChildCount = () => 0,
}: TaskDragContextProps) {
    const [dragWidth, setDragWidth] = useState<number | null>(null);

    const {
        sensors,
        customCollisionDetection,
        activeId,
        handleDragStart,
        handleDragMove,
        handleDragOver,
        handleDragEnd,
    } = useTaskDragAndDrop({
        tasks: allTasks,
        reorderTasks,
        updateTaskTime,
        toggleTask,
        setDraggingTaskId,
    });

    const onDragStart = useCallback((event: DragStartEvent) => {
        handleDragStart(event);
        const node = document.querySelector(`[data-task-id="${event.active.id}"]`);
        if (node instanceof HTMLElement) {
            setDragWidth(node.offsetWidth);
        }
    }, [handleDragStart]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={onDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            {children}

            {createPortal(
                <DragOverlay dropAnimation={null} className="cursor-grabbing" style={{ zIndex: 999999 }}>
                    {activeId ? (() => {
                        const activeTask = allTasks.find(t => t.id === activeId);
                        if (!activeTask) return null;
                        
                        return (
                            <div style={{ width: dragWidth ? `${dragWidth}px` : '100%' }}>
                                <TaskItem
                                    task={activeTask}
                                    isOverlay={true}
                                    onToggle={() => {}}
                                    onUpdate={() => {}}
                                    onDelete={() => {}}
                                    hasChildren={getChildCount(activeTask.id) > 0}
                                    collapsed={activeTask.collapsed}
                                />
                            </div>
                        );
                    })() : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
}