/**
 * CalendarTaskPanel - Unified panel on the right side of calendar
 * 
 * Supports switching between tasks and progress views
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Maximize2, Minimize2, ChevronDown, Check,
  Archive, Search, X
} from 'lucide-react';
import { DndContext, DragOverlay, DragMoveEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import type { TaskStatus } from '@/stores/uiSlice';
import { cn } from '@/lib/utils';
import { EventEditForm } from '../ContextPanel/EventEditForm';
import { PanelTaskInput } from './PanelTaskInput';
import { PanelTaskItem } from './PanelTaskItem';
import { SortableDivider } from './SortableDivider';
import { usePanelDragAndDrop } from './usePanelDragAndDrop';
import { ProgressContent } from '@/components/Progress/features/ProgressContent';
import { getColorPriority, getAllDayInlineStyles, getColorHex } from '@/lib/colors';

type PanelView = 'tasks' | 'progress';

interface CalendarTaskPanelProps {
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function CalendarTaskPanel({ 
  isExpanded = false, 
  onToggleExpand 
}: CalendarTaskPanelProps) {
  const {
    tasks,
    groups,
    activeGroupId,
    setActiveGroup,
    toggleTask,
    updateTask,
    deleteTask,
    reorderTasks,
    addSubTask,
    toggleCollapse,
    updateTaskTime,
    archiveCompletedTasks,
    deleteCompletedTasks,
  } = useGroupStore();

  const {
    hideCompleted,
    selectedColors,
    selectedStatuses,
    setDraggingTaskId,
    setDraggingToCalendarTaskId,
  } = useUIStore();

  const { editingEventId, events, selectedDate, hourHeight, viewMode, dayCount } = useCalendarStore();

  const [panelView, setPanelView] = useState<PanelView>('tasks');
  const [isOverCalendar, setIsOverCalendar] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduledExpanded, setScheduledExpanded] = useState(true);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [showCompletedMenu, setShowCompletedMenu] = useState(false);
  const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
  const [subTaskContent, setSubTaskContent] = useState('');

  const groupPickerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const completedMenuRef = useRef<HTMLDivElement>(null);

  const currentGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  const editingEvent = editingEventId ? events.find(e => e.id === editingEventId) : null;

  const {
    sensors,
    customCollisionDetection,
    activeId,
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
  } = usePanelDragAndDrop({
    tasks,
    reorderTasks,
    updateTaskTime,
    toggleTask,
    setDraggingTaskId,
    calendarInfo: {
      selectedDate,
      hourHeight,
      viewMode,
      dayCount,
    },
  });

  const checkIsOverCalendar = useCallback((event: DragMoveEvent) => {
    const gridContainer = document.getElementById('time-grid-container');
    if (!gridContainer) {
      setIsOverCalendar(false);
      setDraggingToCalendarTaskId(null);
      return;
    }
    
    const rect = gridContainer.getBoundingClientRect();
    const { activatorEvent, active } = event;
    
    if (activatorEvent instanceof MouseEvent || activatorEvent instanceof PointerEvent) {
      const delta = event.delta;
      const initialX = (activatorEvent as MouseEvent).clientX;
      const initialY = (activatorEvent as MouseEvent).clientY;
      const currentX = initialX + delta.x;
      const currentY = initialY + delta.y;
      
      const isOver = currentX >= rect.left && currentX <= rect.right && 
                     currentY >= rect.top && currentY <= rect.bottom;
      setIsOverCalendar(isOver);
      
      if (isOver) {
        const task = tasks.find(t => t.id === active.id);
        if (task?.startDate) {
          setDraggingToCalendarTaskId(task.id);
        }
      } else {
        setDraggingToCalendarTaskId(null);
      }
    }
  }, [tasks, setDraggingToCalendarTaskId]);

  const wrappedHandleDragMove = useCallback((event: DragMoveEvent) => {
    handleDragMove(event);
    checkIsOverCalendar(event);
  }, [handleDragMove, checkIsOverCalendar]);

  const wrappedHandleDragEnd = useCallback((event: Parameters<typeof handleDragEnd>[0]) => {
    handleDragEnd(event);
    setIsOverCalendar(false);
    setDraggingToCalendarTaskId(null);
  }, [handleDragEnd, setDraggingToCalendarTaskId]);

  const getChildren = useCallback((parentId: string) => {
    return tasks
      .filter(t => t.parentId === parentId && t.groupId === activeGroupId)
      .sort((a, b) => a.order - b.order);
  }, [tasks, activeGroupId]);


  const { incompleteTasks, scheduledTasks, completedTasks } = useMemo(() => {
    const topLevelTasks = tasks
      .filter((t) => {
        if (t.groupId !== activeGroupId || t.parentId) return false;
        if (!selectedColors.includes(t.color || 'default')) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          if (!t.content.toLowerCase().includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aColor = getColorPriority(a.color);
        const bColor = getColorPriority(b.color);
        if (aColor !== bColor) return aColor - bColor;
        return a.order - b.order;
      });

    const notCompleted = topLevelTasks.filter((t) => !t.completed);
    const scheduled = notCompleted.filter((t) => t.startDate);
    const unscheduled = notCompleted.filter((t) => !t.startDate);

    const showTodo = selectedStatuses.includes('todo' as TaskStatus);
    const showScheduled = selectedStatuses.includes('scheduled' as TaskStatus);
    const showCompleted = selectedStatuses.includes('completed' as TaskStatus);

    return {
      incompleteTasks: showTodo ? unscheduled : [],
      scheduledTasks: showScheduled ? scheduled : [],
      completedTasks: (hideCompleted || !showCompleted) ? [] : topLevelTasks.filter((t) => t.completed),
    };
  }, [tasks, activeGroupId, hideCompleted, selectedColors, selectedStatuses, searchQuery]);

  const incompleteTaskIds = useMemo(() => {
    const ids: string[] = [];
    const addTaskAndChildren = (task: typeof incompleteTasks[0]) => {
      ids.push(task.id);
      const children = tasks.filter(t => t.parentId === task.id);
      children.forEach(addTaskAndChildren);
    };
    incompleteTasks.forEach(addTaskAndChildren);
    return ids;
  }, [incompleteTasks, tasks]);

  const scheduledTaskIds = useMemo(() => {
    const ids: string[] = [];
    const addTaskAndChildren = (task: typeof scheduledTasks[0]) => {
      ids.push(task.id);
      const children = tasks.filter(t => t.parentId === task.id);
      children.forEach(addTaskAndChildren);
    };
    scheduledTasks.forEach(addTaskAndChildren);
    return ids;
  }, [scheduledTasks, tasks]);

  const completedTaskIds = useMemo(() => {
    const ids: string[] = [];
    const addTaskAndChildren = (task: typeof completedTasks[0]) => {
      ids.push(task.id);
      const children = tasks.filter(t => t.parentId === task.id);
      children.forEach(addTaskAndChildren);
    };
    completedTasks.forEach(addTaskAndChildren);
    return ids;
  }, [completedTasks, tasks]);

  const SCHEDULED_DIVIDER_ID = '__divider_scheduled__';
  const COMPLETED_DIVIDER_ID = '__divider_completed__';

  const allSortableIds = useMemo(() => {
    const ids: string[] = [...incompleteTaskIds];
    
    if (scheduledTasks.length > 0) {
      ids.push(SCHEDULED_DIVIDER_ID);
      if (scheduledExpanded) {
        ids.push(...scheduledTaskIds);
      }
    }
    
    if (completedTasks.length > 0) {
      ids.push(COMPLETED_DIVIDER_ID);
      if (completedExpanded) {
        ids.push(...completedTaskIds);
      }
    }
    
    return ids;
  }, [incompleteTaskIds, scheduledTaskIds, completedTaskIds, scheduledTasks.length, completedTasks.length, scheduledExpanded, completedExpanded]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-color-option]')) return;
      
      if (groupPickerRef.current && !groupPickerRef.current.contains(target)) {
        setShowGroupPicker(false);
      }
      if (completedMenuRef.current && !completedMenuRef.current.contains(target)) {
        setShowCompletedMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const renderTaskItem = useCallback((task: typeof incompleteTasks[0], level: number = 0) => {
    const children = getChildren(task.id);
    const hasChildren = children.length > 0;
    
    const checkAncestorDragged = (taskId: string, visited = new Set<string>()): boolean => {
      if (taskId === activeId) return true;
      if (visited.has(taskId)) return false;
      visited.add(taskId);
      const t = tasks.find(item => item.id === taskId);
      if (t?.parentId) return checkAncestorDragged(t.parentId, visited);
      return false;
    };
    const isBeingDragged = checkAncestorDragged(task.id);
    
    return (
      <div key={task.id}>
        <PanelTaskItem
          task={task}
          onToggle={toggleTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onAddSubTask={handleAddSubTask}
          isBeingDragged={isBeingDragged}
          level={level}
          hasChildren={hasChildren}
          collapsed={task.collapsed}
          onToggleCollapse={() => toggleCollapse(task.id)}
        />
        {hasChildren && !task.collapsed && (
          <div className="ml-4">
            {children.map(child => renderTaskItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [activeId, getChildren, tasks, toggleTask, updateTask, deleteTask, handleAddSubTask, toggleCollapse]);

  if (editingEvent) {
    return (
      <div data-context-panel className="h-full overflow-visible">
        <EventEditForm event={editingEvent} mode="embedded" />
      </div>
    );
  }

  return (
    <div 
      data-context-panel 
      className={cn(
        "h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden",
        isExpanded && "fixed inset-0 z-50"
      )}
    >
      {/* Header: Tab switch + Toolbar */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setPanelView('tasks')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                panelView === 'tasks'
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              Tasks
            </button>
            <button
              onClick={() => setPanelView('progress')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                panelView === 'progress'
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              Progress
            </button>
          </div>

          {/* Tool buttons */}
          <div className="flex items-center gap-1">
            {/* Search button - only shown in tasks view */}
            {panelView === 'tasks' && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  showSearch
                    ? "text-zinc-600 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                )}
              >
                <Search className="size-4" />
              </button>
            )}

            {/* Expand/Collapse button */}
            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Tasks view group selector and search box */}
        {panelView === 'tasks' && (
          <>
            <div className="flex items-center gap-2 mt-2">
              {/* Group selector */}
              <div className="relative flex-1 min-w-0" ref={groupPickerRef}>
                <button
                  onClick={() => setShowGroupPicker(!showGroupPicker)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors max-w-full"
                >
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
                    {currentGroup?.name || 'Inbox'}
                  </span>
                  <ChevronDown className={cn(
                    "size-3.5 text-zinc-400 transition-transform flex-shrink-0",
                    showGroupPicker && "rotate-180"
                  )} />
                </button>

                {/* Group dropdown menu */}
                <AnimatePresence>
                  {showGroupPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50 max-h-64 overflow-y-auto"
                    >
                      {groups.map((group) => (
                        <button
                          key={group.id}
                          onClick={() => {
                            setActiveGroup(group.id);
                            setShowGroupPicker(false);
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-left text-sm transition-colors flex items-center gap-2",
                            group.id === activeGroupId
                              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                              : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          )}
                        >
                          {group.pinned && <span className="text-[10px]">📌</span>}
                          <span className="truncate">{group.name}</span>
                          {group.id === activeGroupId && (
                            <Check className="size-3.5 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      ))}
                      {/* Archive entry */}
                      <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                      <button
                        onClick={() => {
                          setActiveGroup('__archive__');
                          setShowGroupPicker(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-sm transition-colors flex items-center gap-2",
                          activeGroupId === '__archive__'
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        )}
                      >
                        <Archive className="size-3.5" />
                        <span>Archive</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Search box */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative mt-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tasks..."
                      autoFocus
                      className="w-full px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-md outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Progress view */}
      {panelView === 'progress' && (
        <div className="flex-1 overflow-hidden">
          <ProgressContent compact />
        </div>
      )}

      {/* Tasks view */}
      {panelView === 'tasks' && (
        <>
          {/* Task input */}
          {activeGroupId !== '__archive__' && (
            <div className="flex-shrink-0 px-3 pb-2">
              <PanelTaskInput compact={!isExpanded} />
            </div>
          )}

      {/* Task list */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto px-3 pb-3",
          "[&::-webkit-scrollbar]:w-1",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-zinc-200",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:hover:bg-zinc-300",
          "dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800",
          "dark:[&::-webkit-scrollbar-thumb]:hover:bg-zinc-700"
        )}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragMove={wrappedHandleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={wrappedHandleDragEnd}
        >
          {/* Use unified SortableContext for correct cross-region drag positioning */}
          <SortableContext 
            items={allSortableIds} 
            strategy={verticalListSortingStrategy}
          >
            {/* Incomplete tasks */}
            {incompleteTasks.length > 0 ? (
              <div className="space-y-2">
                {incompleteTasks.map(task => renderTaskItem(task, 0))}
              </div>
            ) : scheduledTasks.length === 0 && completedTasks.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-zinc-400 dark:text-zinc-600">No tasks</p>
              </div>
            ) : null}

            {/* Scheduled tasks divider */}
            {scheduledTasks.length > 0 && (
              <SortableDivider
                id={SCHEDULED_DIVIDER_ID}
                label="Scheduled"
                count={scheduledTasks.length}
                expanded={scheduledExpanded}
                onToggleExpand={() => setScheduledExpanded(!scheduledExpanded)}
              />
            )}

            {/* Scheduled tasks */}
            {scheduledTasks.length > 0 && scheduledExpanded && (
              <div className="space-y-2">
                {scheduledTasks.map(task => renderTaskItem(task, 0))}
              </div>
            )}

            {/* Completed tasks divider */}
            {completedTasks.length > 0 && (
              <SortableDivider
                id={COMPLETED_DIVIDER_ID}
                label="Completed"
                count={completedTasks.length}
                expanded={completedExpanded}
                onToggleExpand={() => setCompletedExpanded(!completedExpanded)}
                showMenu={showCompletedMenu}
                onMenuToggle={() => setShowCompletedMenu(!showCompletedMenu)}
                menuRef={completedMenuRef}
                menuContent={
                  activeGroupId !== '__archive__' ? (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50">
                      <button
                        onClick={() => {
                          if (activeGroupId) {
                            archiveCompletedTasks(activeGroupId);
                          }
                          setShowCompletedMenu(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Archive All
                      </button>
                      <button
                        onClick={() => {
                          if (activeGroupId) {
                            deleteCompletedTasks(activeGroupId);
                          }
                          setShowCompletedMenu(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        Delete All
                      </button>
                    </div>
                  ) : undefined
                }
              />
            )}

            {/* Completed tasks */}
            {completedTasks.length > 0 && completedExpanded && (
              <div className="space-y-2 opacity-60">
                {completedTasks.map(task => renderTaskItem(task, 0))}
              </div>
            )}
          </SortableContext>

          {/* Drag Overlay - rendered via portal for cross-panel dragging */}
          {createPortal(
            <DragOverlay dropAnimation={null} className="cursor-grabbing" style={{ zIndex: 999999 }}>
              {activeId ? (() => {
                const task = tasks.find(t => t.id === activeId);
                if (!task) return null;
                
                if (isOverCalendar) {
                  const colorStyles = getAllDayInlineStyles(task.color);
                  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
                  const bgColor = isDark ? colorStyles.bgDark : colorStyles.bg;
                  const textColor = isDark ? colorStyles.textDark : colorStyles.text;
                  const borderColor = isDark ? colorStyles.borderDark : colorStyles.border;
                  const eventHeight = Math.max(hourHeight * (25 / 60), 20);
                  return (
                    <div 
                      className={cn(
                        "w-[120px] flex flex-col",
                        "border-l-[3px]",
                        "rounded-[5px]",
                        "shadow-xl shadow-black/15 dark:shadow-black/40"
                      )}
                      style={{ 
                        height: `${eventHeight}px`,
                        backgroundColor: bgColor,
                        borderLeftColor: borderColor,
                      }}
                    >
                      <div className="flex items-start gap-1.5 px-2 py-1">
                        <div className="flex-1 min-w-0">
                          <p 
                            className="font-medium leading-tight truncate text-[11px]"
                            style={{ color: textColor }}
                          >
                            {task.content || 'Untitled'}
                          </p>
                          {eventHeight >= 32 && (
                            <p 
                              className="mt-0.5 tabular-nums font-medium text-[9px] opacity-70"
                              style={{ color: textColor }}
                            >
                              25m
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                const colorValue = task.color && task.color !== 'default'
                  ? getColorHex(task.color)
                  : undefined;
                
                return (
                  <div className="flex items-start gap-2 px-3 py-2 bg-white dark:bg-zinc-800 rounded-lg shadow-xl ring-1 ring-black/5 dark:ring-white/10 max-w-[240px]">
                    {/* Color checkbox */}
                    <div 
                      className={cn(
                        "flex-shrink-0 w-3.5 h-3.5 rounded-sm mt-0.5",
                        colorValue ? "border-2" : "border border-zinc-400/40"
                      )}
                      style={colorValue ? { borderColor: colorValue } : undefined}
                    />
                    <span className="text-[13px] text-zinc-700 dark:text-zinc-200 line-clamp-2">
                      {task.content}
                    </span>
                  </div>
                );
              })() : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      </div>
        </>
      )}

      {/* Subtask modal */}
      <AnimatePresence>
        {addingSubTaskFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
            onClick={() => setAddingSubTaskFor(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-80 p-4"
            >
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-3">
                Add Sub-task
              </h3>
              <input
                type="text"
                value={subTaskContent}
                onChange={(e) => setSubTaskContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitSubTask();
                  if (e.key === 'Escape') setAddingSubTaskFor(null);
                }}
                placeholder="Sub-task content..."
                autoFocus
                className="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-md outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setAddingSubTaskFor(null)}
                  className="px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitSubTask}
                  disabled={!subTaskContent.trim()}
                  className="px-3 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
