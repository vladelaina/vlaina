/**
 * Panel drag and drop logic
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
import { DEFAULT_EVENT_DURATION_MS } from '@/lib/calendar';
import { CALENDAR_CONSTANTS, getSnapMinutes } from '@/components/Calendar/utils/timeUtils';

interface UsePanelDragAndDropProps {
  tasks: Task[];
  reorderTasks: (activeId: string, overId: string, makeChild?: boolean) => void;
  updateTaskTime: (taskId: string, startDate?: number | null, endDate?: number | null) => void;
  toggleTask: (taskId: string) => void;
  setDraggingTaskId: (id: string | null) => void;
  calendarInfo?: {
    selectedDate: Date;
    hourHeight: number;
    viewMode: string;
    dayCount: number;
  };
}

export function usePanelDragAndDrop({
  tasks,
  reorderTasks,
  updateTaskTime,
  toggleTask,
  setDraggingTaskId,
  calendarInfo,
}: UsePanelDragAndDropProps) {
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

    const gridContainer = document.getElementById('time-grid-container');
    if (gridContainer && calendarInfo) {
      const rect = gridContainer.getBoundingClientRect();
      const dropRect = event.active.rect.current.translated;
      if (dropRect) {
        const x = dropRect.left + 20;
        const y = dropRect.top + 20;
        
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          const { selectedDate, hourHeight, viewMode, dayCount } = calendarInfo;
          const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH;
          const SNAP_MINUTES = getSnapMinutes(hourHeight);
          
          const scrollContainer = document.getElementById('time-grid-scroll');
          const scrollTop = scrollContainer?.scrollTop || 0;
          
          const relativeX = x - rect.left - GUTTER_WIDTH;
          if (relativeX < 0) return;
          
          const numDays = viewMode === 'week' ? 7 : (dayCount || 1);
          const dayWidth = (rect.width - GUTTER_WIDTH) / numDays;
          const dayIndex = Math.floor(relativeX / dayWidth);
          if (dayIndex < 0 || dayIndex >= numDays) return;
          
          const relativeY = y - rect.top + scrollTop;
          const totalMinutes = (relativeY / hourHeight) * 60;
          const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
          
          const selected = new Date(selectedDate);
          let weekStart: Date;
          if (viewMode === 'week') {
            const dayOfWeek = selected.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            weekStart = new Date(selected);
            weekStart.setDate(selected.getDate() + mondayOffset);
          } else {
            weekStart = selected;
          }
          weekStart.setHours(0, 0, 0, 0);
          
          const dayDate = new Date(weekStart);
          dayDate.setDate(weekStart.getDate() + dayIndex);
          
          const startDate = new Date(dayDate);
          startDate.setHours(0, 0, 0, 0);
          startDate.setMinutes(snappedMinutes);
          
          const endDate = new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MS);
          
          updateTaskTime(activeTask.id, startDate.getTime(), endDate.getTime());
          return;
        }
      }
    }

    if (!over || active.id === over.id) return;

    const overId = over.id as string;
    
    if (overId === '__divider_scheduled__') {
      if (activeTask.startDate) {
        updateTaskTime(activeTask.id, null, null);
      } else if (!activeTask.completed) {
        const startTime = Date.now();
        const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
        updateTaskTime(activeTask.id, startTime, endTime);
      }
      return;
    }
    
    if (overId === '__divider_completed__') {
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
      if (activeIsScheduled && !activeIsCompleted && !overIsScheduled && !overIsCompleted) {
        updateTaskTime(activeTask.id, null, null);
        return;
      }
      if (!activeIsScheduled && !activeIsCompleted && overIsScheduled && !overIsCompleted) {
        const startTime = Date.now();
        const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
        updateTaskTime(activeTask.id, startTime, endTime);
        return;
      }
      if (activeIsScheduled && !activeIsCompleted && overIsCompleted) {
        updateTaskTime(activeTask.id, null, null);
        toggleTask(activeTask.id);
        return;
      }
      if (!activeIsScheduled && !activeIsCompleted && overIsCompleted) {
        toggleTask(activeTask.id);
        return;
      }
      if (activeIsCompleted && !overIsScheduled && !overIsCompleted) {
        toggleTask(activeTask.id);
        return;
      }
      if (activeIsCompleted && overIsScheduled && !overIsCompleted) {
        toggleTask(activeTask.id);
        const startTime = Date.now();
        const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
        updateTaskTime(activeTask.id, startTime, endTime);
        return;
      }
      return;
    }

    const INDENT_THRESHOLD = 28;
    const makeChild = dragIndent > INDENT_THRESHOLD;
    reorderTasks(active.id as string, over.id as string, makeChild);
  }, [tasks, dragIndent, reorderTasks, updateTaskTime, toggleTask, setDraggingTaskId, calendarInfo]);

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
