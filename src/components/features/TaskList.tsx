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
import { motion, AnimatePresence } from 'framer-motion';

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
  const { tasks, toggleTask, updateTask, deleteTask, reorderTasks, activeGroupId, setDraggingTaskId, hideCompleted, moveTaskToGroup, toggleCollapse, addSubTask } = useGroupStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
  const [subTaskContent, setSubTaskContent] = useState('');
  const originalGroupIdRef = useRef<string | null>(null);
  const subTaskInputRef = useRef<HTMLTextAreaElement>(null);

  // Get children for a task
  const getChildren = useCallback((parentId: string) => {
    return tasks
      .filter(t => t.parentId === parentId && t.groupId === activeGroupId)
      .sort((a, b) => a.order - b.order);
  }, [tasks, activeGroupId]);

  // Handle add subtask - show modal input
  const handleAddSubTask = useCallback((parentId: string) => {
    setAddingSubTaskFor(parentId);
    setSubTaskContent('');
  }, []);

  const handleSubmitSubTask = useCallback(() => {
    if (addingSubTaskFor && subTaskContent.trim()) {
      addSubTask(addingSubTaskFor, subTaskContent.trim());
    }
    setAddingSubTaskFor(null);
    setSubTaskContent('');
  }, [addingSubTaskFor, subTaskContent, addSubTask]);

  const handleCancelSubTask = useCallback(() => {
    setAddingSubTaskFor(null);
    setSubTaskContent('');
  }, []);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (addingSubTaskFor && subTaskInputRef.current) {
      subTaskInputRef.current.focus();
    }
  }, [addingSubTaskFor]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = subTaskInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [subTaskContent]);

  // Filter tasks by current group - only top-level tasks
  const { incompleteTasks, completedTasks } = useMemo(() => {
    const topLevelTasks = tasks
      .filter((t) => t.groupId === activeGroupId && !t.parentId)
      .sort((a, b) => a.order - b.order);
    
    return {
      incompleteTasks: topLevelTasks.filter((t) => !t.completed),
      completedTasks: hideCompleted ? [] : topLevelTasks.filter((t) => t.completed),
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
    
    const task = tasks.find(t => t.id === id);
    if (task) {
      // Count all descendants recursively (including the task itself in subtree)
      const countDescendants = (taskId: string): number => {
        const children = tasks.filter(t => t.parentId === taskId);
        if (children.length === 0) return 0;
        return children.length + children.reduce((sum, child) => sum + countDescendants(child.id), 0);
      };
      const childCount = countDescendants(task.id);
      
      // Get actual dimensions of the task element
      const taskElement = document.querySelector(`[data-task-id="${id}"]`);
      const rect = taskElement?.getBoundingClientRect();
      const width = rect?.width || 350;
      const height = rect?.height || 36;
      
      // Get mouse position (screen coordinates) and detect dark mode
      const pointer = (event.activatorEvent as PointerEvent);
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      // Add child count indicator if task has children
      const displayContent = childCount > 0 
        ? `${task.content} (+${childCount})` 
        : task.content;
      
      try {
        await invoke('create_drag_window', {
          content: displayContent,
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
  }, [tasks, activeGroupId, setDraggingTaskId]);

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

  const renderTaskItem = (task: typeof filteredTasks[0], level: number = 0): React.ReactNode => {
    const activeIndex = activeId ? filteredTasks.findIndex(t => t.id === activeId) : -1;
    const overIndex = overId ? filteredTasks.findIndex(t => t.id === overId) : -1;
    const isDropTarget = task.id === overId && overId !== activeId;
    const insertAfter = isDropTarget && activeIndex !== -1 && overIndex > activeIndex;
    
    const children = getChildren(task.id);
    const hasChildren = children.length > 0;
    
    // Check if this task or any ancestor is being dragged
    const checkAncestorDragged = (taskId: string, visited = new Set<string>()): boolean => {
      if (taskId === activeId) return true;
      if (visited.has(taskId)) return false; // Prevent infinite loop
      visited.add(taskId);
      const t = tasks.find(task => task.id === taskId);
      if (t?.parentId) return checkAncestorDragged(t.parentId, visited);
      return false;
    };
    const isBeingDragged = checkAncestorDragged(task.id);
    
    return (
      <div key={task.id}>
        <TaskItem
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
          onAddSubTask={handleAddSubTask}
          isBeingDragged={isBeingDragged}
          isDropTarget={isDropTarget}
          insertAfter={insertAfter}
          level={level}
          hasChildren={hasChildren}
          collapsed={task.collapsed}
          onToggleCollapse={() => toggleCollapse(task.id)}
        />
        {/* Render children recursively if not collapsed */}
        {hasChildren && !task.collapsed && (
          <div className="ml-6">
            {children.map(child => renderTaskItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
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
              {incompleteTasks.map(task => renderTaskItem(task, 0))}
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
                  {completedTasks.map(task => renderTaskItem(task, 0))}
                </div>
              )}
            </>
          )}
        </SortableContext>
      </DndContext>

      {/* Subtask Input Modal */}
      <AnimatePresence>
        {addingSubTaskFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancelSubTask}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-[500px] max-w-[90vw] p-4"
            >
              <textarea
                ref={subTaskInputRef}
                value={subTaskContent}
                onChange={(e) => setSubTaskContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitSubTask();
                  } else if (e.key === 'Escape') {
                    handleCancelSubTask();
                  }
                }}
                placeholder="输入子任务内容... (Enter 确认, Shift+Enter 换行, Esc 取消)"
                rows={1}
                className="w-full bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/50 leading-relaxed min-h-[60px] max-h-[400px] overflow-y-auto"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
