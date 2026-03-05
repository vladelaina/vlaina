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
  closestCenter,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { NekoEvent } from '@/lib/ics/types';
import { DEFAULT_EVENT_DURATION_MS } from '@/lib/calendar';
import { CALENDAR_CONSTANTS, getSnapMinutes } from '@/components/Calendar/utils/timeUtils';

interface UsePanelDragAndDropProps {
  tasks: NekoEvent[];
  reorderTasks: (activeId: string, overId: string, makeChild?: boolean) => void;
  updateTaskTime: (taskId: string, startDate?: number | null, endDate?: number | null) => void;
  toggleTask: (taskId: string) => void;
  setDraggingTaskId: (id: string | null) => void;
  onAddEvent?: (eventData: { summary: string; dtstart: Date; dtend: Date; allDay: boolean }) => string;
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
  onAddEvent,
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

  const customCollisionDetection: CollisionDetection = useCallback(
    (args) => {
      // Log collision detection inputs


      // 1. Check Grid
      if (calendarInfo) {
        const gridContainer = document.getElementById('time-grid-container');
        if (gridContainer && args.pointerCoordinates) {
          const rect = gridContainer.getBoundingClientRect();
          const { x, y } = args.pointerCoordinates;

          const EDGE_BUFFER = 50;
          const inGrid = x >= rect.left + EDGE_BUFFER &&
            x <= rect.right - EDGE_BUFFER &&
            y >= rect.top + EDGE_BUFFER &&
            y <= rect.bottom - EDGE_BUFFER;

          if (inGrid) {

            return [];
          }
        }
      }

      // 2. List Check
      const collisions = closestCenter(args);

      return collisions;
    },
    [calendarInfo]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {

    setActiveId(event.active.id as string);
    setDraggingTaskId(event.active.id as string);
    dragStartX.current = event.active.rect.current.initial?.left ?? 0;
  }, [setDraggingTaskId]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { active, over } = event;
    const activeInitialLeft = active.rect.current.initial?.left ?? 0;
    const currentLeft = active.rect.current.translated?.left ?? 0;
    const deltaX = currentLeft - activeInitialLeft;



    setDragIndent(deltaX);

    if (!over) {
      if (overId) {
        // Lost over
      }
      setOverId(null);
      return;
    }
  }, [overId]); // Added overId dep for logging check

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;

    setOverId(over?.id as string || null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {

    const { active, over } = event;

    setActiveId(null);
    setOverId(null);
    setDragIndent(0);
    setDraggingTaskId(null);

    const activeTask = tasks.find(t => t.uid === active.id);
    if (!activeTask) {

      return;
    }

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

          const startDate = new Date(weekStart);
          startDate.setDate(weekStart.getDate() + dayIndex);
          startDate.setHours(0, 0, 0, 0);
          startDate.setMinutes(snappedMinutes);

          const endDate = new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MS);

          onAddEvent?.({
            summary: activeTask.summary,
            dtstart: startDate,
            dtend: endDate,
            allDay: false,
          });
          return;
        }
      }
    }

    if (!over) return;

      const overId = over.id as string;
      const activeIsScheduled = activeTask.scheduled !== false;

      if (overId === '__divider_scheduled__') {
      if (activeIsScheduled) {

      } else if (!activeTask.completed) {
        const startTime = Date.now();
        const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
        updateTaskTime(activeTask.uid, startTime, endTime);
      }
      return;
    }

    if (overId === '__divider_completed__') {
      if (!activeTask.completed) {
        toggleTask(activeTask.uid);
      }
      return;
    }

    if (active.id !== over.id) {
      const overTask = tasks.find(t => t.uid === over.id);
      if (!overTask) {
        return;
      }

      const activeIsCompleted = activeTask.completed;
      const overIsScheduled = overTask.scheduled !== false;
      const overIsCompleted = overTask.completed;

      const isCrossSection = (activeIsScheduled !== overIsScheduled) || (activeIsCompleted !== overIsCompleted);

      if (isCrossSection) {
        if (overIsCompleted) {
          if (!activeIsCompleted) toggleTask(activeTask.uid);
          return;
        }
        if (overIsScheduled) {
          if (!activeIsScheduled) {
            const startTime = Date.now();
            const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
            updateTaskTime(activeTask.uid, startTime, endTime);
          }
          if (activeIsCompleted) toggleTask(activeTask.uid);
          return;
        }
        if (activeIsScheduled) updateTaskTime(activeTask.uid, null, null);
        if (activeIsCompleted) toggleTask(activeTask.uid);
        return;
      }

      const INDENT_THRESHOLD = 28;
      const makeChild = dragIndent > INDENT_THRESHOLD;
      reorderTasks(active.id as string, over.id as string, makeChild);
    }

  }, [tasks, dragIndent, reorderTasks, updateTaskTime, toggleTask, setDraggingTaskId, calendarInfo, onAddEvent]);

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
