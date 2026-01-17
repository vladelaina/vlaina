/**
 * useTaskDragAndDrop - Standalone drag and drop hook for task lists
 * 
 * This is a Calendar-independent version. It handles:
 * - Task reordering within a list
 * - Section transitions (todo <-> scheduled <-> completed)
 * - Subtask creation via horizontal drag
 * 
 * It does NOT handle: Calendar grid drop detection (that's Calendar-specific)
 */

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
import type { Task } from '@/stores/useGroupStore';

// Default duration when scheduling a task (25 minutes)
const DEFAULT_DURATION_MS = 25 * 60 * 1000;

interface UseTaskDragAndDropProps {
    tasks: Task[];
    reorderTasks: (activeId: string, overId: string, makeChild?: boolean) => void;
    updateTaskTime: (taskId: string, startDate?: number | null, endDate?: number | null) => void;
    toggleTask: (taskId: string) => void;
    setDraggingTaskId: (id: string | null) => void;
}

export function useTaskDragAndDrop({
    tasks,
    reorderTasks,
    updateTaskTime,
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

        const activeTask = tasks.find(t => t.id === active.id);
        if (!activeTask) return;

        // No Calendar grid detection in this standalone version

        if (!over || active.id === over.id) return;

        const overIdStr = over.id as string;

        // Handle divider drops
        if (overIdStr === '__divider_scheduled__') {
            if (activeTask.startDate) {
                // Already scheduled -> unschedule
                updateTaskTime(activeTask.id, null, null);
            } else if (!activeTask.completed) {
                // Unscheduled -> schedule for now
                const startTime = Date.now();
                const endTime = startTime + DEFAULT_DURATION_MS;
                updateTaskTime(activeTask.id, startTime, endTime);
            }
            return;
        }

        if (overIdStr === '__divider_completed__') {
            return;
        }

        const overTask = tasks.find(t => t.id === over.id);
        if (!overTask) return;

        const activeIsScheduled = !!activeTask.startDate;
        const activeIsCompleted = activeTask.completed;
        const overIsScheduled = !!overTask.startDate;
        const overIsCompleted = overTask.completed;

        const isCrossSection = (activeIsScheduled !== overIsScheduled) || (activeIsCompleted !== overIsCompleted);

        if (isCrossSection) {
            // Scheduled -> Unscheduled
            if (activeIsScheduled && !activeIsCompleted && !overIsScheduled && !overIsCompleted) {
                updateTaskTime(activeTask.id, null, null);
                return;
            }
            // Unscheduled -> Scheduled
            if (!activeIsScheduled && !activeIsCompleted && overIsScheduled && !overIsCompleted) {
                const startTime = Date.now();
                const endTime = startTime + DEFAULT_DURATION_MS;
                updateTaskTime(activeTask.id, startTime, endTime);
                return;
            }
            // Scheduled -> Completed
            if (activeIsScheduled && !activeIsCompleted && overIsCompleted) {
                updateTaskTime(activeTask.id, null, null);
                toggleTask(activeTask.id);
                return;
            }
            // Unscheduled -> Completed
            if (!activeIsScheduled && !activeIsCompleted && overIsCompleted) {
                toggleTask(activeTask.id);
                return;
            }
            // Completed -> Unscheduled
            if (activeIsCompleted && !overIsScheduled && !overIsCompleted) {
                toggleTask(activeTask.id);
                return;
            }
            // Completed -> Scheduled
            if (activeIsCompleted && overIsScheduled && !overIsCompleted) {
                toggleTask(activeTask.id);
                const startTime = Date.now();
                const endTime = startTime + DEFAULT_DURATION_MS;
                updateTaskTime(activeTask.id, startTime, endTime);
                return;
            }
            return;
        }

        // Same section reorder + potential subtask creation
        const INDENT_THRESHOLD = 28;
        const makeChild = dragIndent > INDENT_THRESHOLD;
        reorderTasks(active.id as string, over.id as string, makeChild);
    }, [tasks, dragIndent, reorderTasks, updateTaskTime, toggleTask, setDraggingTaskId]);

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
