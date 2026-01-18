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
  closestCenter,
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
  /** Optional callback for adding calendar events (injected from parent) */
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
      // console.log('[DnD] Detect:', { y: args.pointerCoordinates?.y, active: args.active.id });

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
            console.log('[DnD] In Grid Buffer');
            return [];
          }
        }
      }

      // 2. List Check
      const collisions = closestCenter(args);
      console.log('[DnD] List Collisions:', collisions.length, collisions[0]?.id);
      return collisions;
    },
    [calendarInfo]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('[DnD] Start:', event.active.id);
    setActiveId(event.active.id as string);
    setDraggingTaskId(event.active.id as string);
    dragStartX.current = event.active.rect.current.initial?.left ?? 0;
  }, [setDraggingTaskId]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { active, over } = event;
    const activeInitialLeft = active.rect.current.initial?.left ?? 0;
    const currentLeft = active.rect.current.translated?.left ?? 0;
    const deltaX = currentLeft - activeInitialLeft;

    // console.log('[DnD] Move:', { active: active.id, over: over?.id, deltaX });

    setDragIndent(deltaX);

    if (!over) {
      if (overId) console.log('[DnD] Lost Over');
      setOverId(null);
      return;
    }
  }, [overId]); // Added overId dep for logging check

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    // console.log('[DnD] Over:', over?.id);
    setOverId(over?.id as string || null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    console.log('[DnD] End:', { active: event.active.id, over: event.over?.id });
    const { active, over } = event;

    // Reset drag state
    setActiveId(null);
    setOverId(null);
    setDragIndent(0);
    setDraggingTaskId(null);

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) {
      console.log('[DnD] Active task not found in list');
      return;
    }

    // Check if dropped on calendar grid
    const gridContainer = document.getElementById('time-grid-container');
    if (gridContainer && calendarInfo) {
      const rect = gridContainer.getBoundingClientRect();
      const dropRect = event.active.rect.current.translated;
      if (dropRect) {
        const x = dropRect.left + 20;
        const y = dropRect.top + 20;

        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          console.log('[DnD] Dropped on Grid (Rect check passed)');
          const { selectedDate, hourHeight, viewMode, dayCount } = calendarInfo;
          const GUTTER_WIDTH = CALENDAR_CONSTANTS.GUTTER_WIDTH;
          const SNAP_MINUTES = getSnapMinutes(hourHeight); // Use snap utility

          const scrollContainer = document.getElementById('time-grid-scroll');
          const scrollTop = scrollContainer?.scrollTop || 0;

          // Calculate horizontal position (Day)
          const relativeX = x - rect.left - GUTTER_WIDTH;
          if (relativeX < 0) return;

          const numDays = viewMode === 'week' ? 7 : (dayCount || 1);
          const dayWidth = (rect.width - GUTTER_WIDTH) / numDays;
          const dayIndex = Math.floor(relativeX / dayWidth);
          if (dayIndex < 0 || dayIndex >= numDays) return;

          // Calculate vertical position (Time)
          const relativeY = y - rect.top + scrollTop;
          const totalMinutes = (relativeY / hourHeight) * 60;
          const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;

          // Determine date and time
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

          // Create a new calendar event (NekoEvent) instead of updating the task
          // This ensures it appears on the calendar grid which now only shows ICS events
          onAddEvent?.({
            summary: activeTask.content,
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

    // Handle dividers (moving to Scheduled or Completed sections)
    if (overId === '__divider_scheduled__') {
      if (activeTask.startDate) {
        // Was scheduled, staying scheduled (or moving between scheduled items) - handled by normal sort
        // But if dragged specifically onto the divider, maybe we want to unset time? 
        // Or if coming from unscheduled, set time.
        // Assuming divider means "become scheduled" broadly, or just sort order.
        // For simplicity, if dropping on scheduled divider and it wasn't scheduled, schedule it for today.
        if (!activeTask.startDate && !activeTask.completed) {
          const startTime = Date.now();
          const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
          updateTaskTime(activeTask.id, startTime, endTime);
        }
      } else if (!activeTask.completed) {
        // From unscheduled to scheduled
        const startTime = Date.now();
        const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
        updateTaskTime(activeTask.id, startTime, endTime);
      }
      return;
    }

    if (overId === '__divider_completed__') {
      // If dropped on completed divider, mark complete?
      if (!activeTask.completed) {
        toggleTask(activeTask.id);
      }
      return;
    }

    // Handle normal reorder
    if (active.id !== over.id) {
      const overTask = tasks.find(t => t.id === over.id);
      if (!overTask) {
        // Maybe dragging over a divider processed above, or something else
        return;
      }

      // Check for cross-section moves (e.g. Unscheduled -> Scheduled)
      const activeIsScheduled = !!activeTask.startDate;
      const activeIsCompleted = activeTask.completed;
      const overIsScheduled = !!overTask.startDate;
      const overIsCompleted = overTask.completed;

      const isCrossSection = (activeIsScheduled !== overIsScheduled) || (activeIsCompleted !== overIsCompleted);

      if (isCrossSection) {
        // Handle property updates based on where we dropped
        if (overIsCompleted) {
          if (!activeIsCompleted) toggleTask(activeTask.id);
          return;
        }
        if (overIsScheduled) {
          if (!activeIsScheduled) {
            const startTime = Date.now();
            const endTime = startTime + DEFAULT_EVENT_DURATION_MS;
            updateTaskTime(activeTask.id, startTime, endTime);
          }
          if (activeIsCompleted) toggleTask(activeTask.id);
          return;
        }
        // Dropped in Unscheduled
        if (activeIsScheduled) updateTaskTime(activeTask.id, null, null);
        if (activeIsCompleted) toggleTask(activeTask.id);
        return;
      }

      // Same section reorder
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
