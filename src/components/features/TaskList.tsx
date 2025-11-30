import { useMemo, useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { invoke } from '@tauri-apps/api/core';

import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskItem } from './TaskItem';
import { useGroupStore } from '@/stores/useGroupStore';

// Update position without awaiting result for smoother animation
const updatePositionFast = (x: number, y: number) => {
  invoke('update_drag_window_position', { x, y }).catch(() => {});
};

export function TaskList() {
  const { tasks, toggleTask, updateTask, deleteTask, reorderTasks, activeGroupId } = useGroupStore();
  const [, setActiveId] = useState<string | null>(null);

  // Filter tasks by current group
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => t.groupId === activeGroupId).sort((a, b) => a.order - b.order);
  }, [tasks, activeGroupId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const taskIds = useMemo(() => filteredTasks.map((t) => t.id), [filteredTasks]);

  const handleDragStart = useCallback(async (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    
    const task = filteredTasks.find(t => t.id === id);
    if (task) {
      // Get actual dimensions of the task element
      const taskElement = document.querySelector(`[data-task-id="${id}"]`);
      const rect = taskElement?.getBoundingClientRect();
      const width = rect?.width || 350;
      const height = rect?.height || 36;
      
      // Get mouse position (screen coordinates)
      const pointer = (event.activatorEvent as PointerEvent);
      try {
        await invoke('create_drag_window', {
          content: task.content,
          x: pointer.screenX,
          y: pointer.screenY,
          width: width,
          height: height,
        });
      } catch (e) {
        console.error('Failed to create drag window:', e);
      }
    }
  }, [filteredTasks]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const rect = (event.activatorEvent as PointerEvent);
    // Calculate current position
    const x = rect.screenX + (event.delta?.x || 0);
    const y = rect.screenY + (event.delta?.y || 0);
    updatePositionFast(x, y);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    // Destroy drag window
    try {
      await invoke('destroy_drag_window');
    } catch (e) {
      // ignore
    }
    
    if (over && active.id !== over.id) {
      reorderTasks(active.id as string, over.id as string);
    }
  }, [reorderTasks]);

  // Cleanup: destroy drag window on unmount
  useEffect(() => {
    return () => {
      invoke('destroy_drag_window').catch(() => {});
    };
  }, []);

  if (filteredTasks.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground text-sm">
          No tasks
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={{
                  id: task.id,
                  content: task.content,
                  isDone: task.completed,
                  createdAt: task.createdAt,
                  groupId: task.groupId,
                  completedAt: task.completedAt ? new Date(task.completedAt).toISOString().split('T')[0] : undefined,
                }}
                onToggle={toggleTask}
                onUpdate={updateTask}
                onUpdateTime={() => {}}
                onDelete={deleteTask}
              />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}
