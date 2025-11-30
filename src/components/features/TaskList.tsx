import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  type DragOverEvent,
} from '@dnd-kit/core';
import { invoke } from '@tauri-apps/api/core';
import { ChevronRight, ChevronDown } from 'lucide-react';

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
  const { tasks, toggleTask, updateTask, deleteTask, reorderTasks, activeGroupId, setDraggingTaskId, hideCompleted, moveTaskToGroup } = useGroupStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const originalGroupIdRef = useRef<string | null>(null);

  // Filter tasks by current group and split into incomplete/completed
  const { incompleteTasks, completedTasks } = useMemo(() => {
    const allTasks = tasks
      .filter((t) => t.groupId === activeGroupId)
      .sort((a, b) => a.order - b.order);
    
    return {
      incompleteTasks: allTasks.filter((t) => !t.completed),
      completedTasks: hideCompleted ? [] : allTasks.filter((t) => t.completed),
    };
  }, [tasks, activeGroupId, hideCompleted]);

  const filteredTasks = useMemo(() => {
    return [...incompleteTasks, ...completedTasks];
  }, [incompleteTasks, completedTasks]);

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
    setDraggingTaskId(id);
    // Save original group for cross-group move detection
    originalGroupIdRef.current = activeGroupId;
    
    const task = filteredTasks.find(t => t.id === id);
    if (task) {
      // Get actual dimensions of the task element
      const taskElement = document.querySelector(`[data-task-id="${id}"]`);
      const rect = taskElement?.getBoundingClientRect();
      const width = rect?.width || 350;
      const height = rect?.height || 36;
      
      // Get mouse position (screen coordinates) and detect dark mode
      const pointer = (event.activatorEvent as PointerEvent);
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      try {
        await invoke('create_drag_window', {
          content: task.content,
          x: pointer.screenX,
          y: pointer.screenY,
          width: width,
          height: height,
          isDone: task.completed,
          isDark: isDarkMode,
        });
      } catch (e) {
        console.error('Failed to create drag window:', e);
      }
    }
  }, [filteredTasks, setDraggingTaskId]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const rect = (event.activatorEvent as PointerEvent);
    // Calculate current position
    const x = rect.screenX + (event.delta?.x || 0);
    const y = rect.screenY + (event.delta?.y || 0);
    updatePositionFast(x, y);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    const taskId = active.id as string;
    const originalGroupId = originalGroupIdRef.current;
    
    // Check if this is a cross-group move (group changed during drag)
    if (originalGroupId && activeGroupId && originalGroupId !== activeGroupId) {
      // Move task to the new group at the drop position
      moveTaskToGroup(taskId, activeGroupId, over?.id as string | null);
    } else if (over && active.id !== over.id) {
      // Check if dragging across completion status boundary
      const draggedTask = tasks.find(t => t.id === taskId);
      const targetTask = tasks.find(t => t.id === over.id);
      
      if (draggedTask && targetTask && draggedTask.completed !== targetTask.completed) {
        // Cross-status drag: toggle the dragged task's status first
        toggleTask(taskId);
        // Small delay to let the state update, then reorder
        setTimeout(() => {
          reorderTasks(taskId, over.id as string);
        }, 50);
      } else {
        // Same status reorder - update task order BEFORE clearing activeId
        // Otherwise the dragged task will briefly appear at its old position (flicker)
        reorderTasks(taskId, over.id as string);
      }
    }
    
    // Now safe to show the task (it's already at the new position)
    setActiveId(null);
    setOverId(null);
    originalGroupIdRef.current = null;
    
    // Destroy drag window
    try {
      await invoke('destroy_drag_window');
    } catch (e) {
      // ignore
    }
    
    // Delay clearing draggingTaskId to allow cross-group drop handlers to execute
    setTimeout(() => {
      setDraggingTaskId(null);
    }, 50);
  }, [reorderTasks, setDraggingTaskId, activeGroupId, moveTaskToGroup, tasks, toggleTask]);

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

  const renderTaskItem = (task: typeof filteredTasks[0]) => {
    const activeIndex = activeId ? filteredTasks.findIndex(t => t.id === activeId) : -1;
    const overIndex = overId ? filteredTasks.findIndex(t => t.id === overId) : -1;
    const isDropTarget = task.id === overId && overId !== activeId;
    const insertAfter = isDropTarget && activeIndex !== -1 && overIndex > activeIndex;
    
    return (
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
        isBeingDragged={task.id === activeId}
        isDropTarget={isDropTarget}
        insertAfter={insertAfter}
      />
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        {/* Incomplete Tasks Section */}
        {incompleteTasks.length > 0 && (
          <div className="space-y-0.5">
            {incompleteTasks.map(renderTaskItem)}
          </div>
        )}

        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <>
            <button
              onClick={() => setCompletedExpanded(!completedExpanded)}
              className="my-6 flex items-center gap-2 w-full group hover:opacity-80 transition-opacity"
            >
              {completedExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-muted-foreground">
                Completed ({completedTasks.length})
              </span>
              <div className="flex-1 h-px bg-border" />
            </button>
            {completedExpanded && (
              <div className="space-y-0.5 opacity-60">
                {completedTasks.map(renderTaskItem)}
              </div>
            )}
          </>
        )}
      </SortableContext>
    </DndContext>
  );
}
