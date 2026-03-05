import { useState, useCallback, useRef } from 'react';
import {
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor,
    type DragStartEvent,
    type DragMoveEvent,
    type DragOverEvent,
    type DragEndEvent,
    type CollisionDetection,
    pointerWithin,
    rectIntersection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { NekoEvent } from '@/stores/types';

interface UseTaskDragAndDropProps {
    tasks: NekoEvent[];
    reorderTasks: (activeId: string, overId: string, makeChild?: boolean) => void;
    toggleTask: (taskId: string) => void;
    setDraggingTaskId: (id: string | null) => void;
}

export function useTaskDragAndDrop({
    tasks,
    reorderTasks,
    toggleTask,
    setDraggingTaskId,
}: UseTaskDragAndDropProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [dragIndent, setDragIndent] = useState(0);
    const dragStartX = useRef<number>(0);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const customCollisionDetection: CollisionDetection = useCallback((args) => {
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) {
            return pointerCollisions;
        }
        return rectIntersection(args);
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setDraggingTaskId(active.id as string);

        if (event.activatorEvent instanceof PointerEvent) {
            dragStartX.current = event.activatorEvent.clientX;
        }
    }, [setDraggingTaskId]);

    const handleDragMove = useCallback((event: DragMoveEvent) => {
        if (event.activatorEvent instanceof PointerEvent) {
            const currentX = event.activatorEvent.clientX;
            const deltaX = currentX - dragStartX.current;
            setDragIndent(Math.max(0, deltaX));
        }
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        setOverId(over?.id as string | null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        setActiveId(null);
        setOverId(null);
        setDragIndent(0);
        setDraggingTaskId(null);

        const activeTask = tasks.find(t => t.uid === active.id);
        if (!activeTask) return;

        if (!over || active.id === over.id) return;

        const overIdStr = over.id as string;

        if (overIdStr === '__divider_completed__') {
            return;
        }

        const overTask = tasks.find(t => t.uid === over.id);
        if (!overTask) return;

        const activeIsCompleted = activeTask.completed;
        const overIsCompleted = overTask.completed;

        const isCrossSection = activeIsCompleted !== overIsCompleted;

        if (isCrossSection) {
            if (!activeIsCompleted && overIsCompleted) {
                toggleTask(activeTask.uid);
                return;
            }
            if (activeIsCompleted && !overIsCompleted) {
                toggleTask(activeTask.uid);
                return;
            }
            return;
        }

        const INDENT_THRESHOLD = 28;
        const makeChild = dragIndent > INDENT_THRESHOLD;
        reorderTasks(active.id as string, over.id as string, makeChild);
    }, [tasks, dragIndent, reorderTasks, toggleTask, setDraggingTaskId]);

    return {
        sensors,
        customCollisionDetection,
        activeId,
        overId,
        dragIndent,
        handleDragStart,
        handleDragMove,
        handleDragOver,
        handleDragEnd,
    };
}
