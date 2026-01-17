/**
 * CalendarTaskPanel - Unified panel on the right side of calendar
 * 
 * Supports switching between tasks and progress views
 * Refactored to use modular components and hooks
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { DragMoveEvent } from '@dnd-kit/core';

import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { cn } from '@/lib/utils';
import { EventEditForm } from '../ContextPanel/EventEditForm';
import { usePanelDragAndDrop } from './usePanelDragAndDrop';
import { ProgressContent } from '@/components/Progress/features/ProgressContent';

// Hooks
import { useTaskData } from './hooks/useTaskData';
import { useTaskPanelState } from './hooks/useTaskPanelState';

// Components
import { PanelHeader } from './components/PanelHeader';
import { SearchBar } from './components/SearchBar';
import { GroupSelector } from './components/GroupSelector';
import { SubTaskModal } from './components/SubTaskModal';
import { TaskListView } from './views/TaskListView';

interface CalendarTaskPanelProps {
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function CalendarTaskPanel({
  isExpanded = false,
  onToggleExpand
}: CalendarTaskPanelProps) {
  // Stores
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

  // Local state
  const [isOverCalendar, setIsOverCalendar] = useState(false);

  // Refs
  const groupPickerRef = useRef<HTMLDivElement>(null);
  const completedMenuRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const uiState = useTaskPanelState();

  const taskData = useTaskData({
    tasks,
    activeGroupId,
    selectedColors,
    selectedStatuses,
    searchQuery: uiState.searchQuery,
    hideCompleted,
  });

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

  // Check if dragging over calendar
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

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-color-option]')) return;

      if (groupPickerRef.current && !groupPickerRef.current.contains(target)) {
        uiState.setShowGroupPicker(false);
      }
      if (completedMenuRef.current && !completedMenuRef.current.contains(target)) {
        uiState.setShowCompletedMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [uiState]);

  // SubTask handlers
  const handleAddSubTask = useCallback((parentId: string) => {
    uiState.setAddingSubTaskFor(parentId);
    uiState.setSubTaskContent('');
  }, [uiState]);

  const handleSubmitSubTask = useCallback(() => {
    if (uiState.addingSubTaskFor && uiState.subTaskContent.trim()) {
      addSubTask(uiState.addingSubTaskFor, uiState.subTaskContent.trim());
    }
    uiState.setAddingSubTaskFor(null);
    uiState.setSubTaskContent('');
  }, [uiState.addingSubTaskFor, uiState.subTaskContent, addSubTask, uiState]);

  const editingEvent = editingEventId ? events.find(e => e.uid === editingEventId) : null;

  // If editing event, show EventEditForm
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
      {/* Header */}
      <PanelHeader
        panelView={uiState.panelView}
        onViewChange={uiState.setPanelView}
        showSearch={uiState.showSearch}
        onToggleSearch={() => uiState.setShowSearch(!uiState.showSearch)}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        hideSearchButton={uiState.panelView !== 'tasks'}
      />

      {/* Tasks view controls */}
      {uiState.panelView === 'tasks' && (
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="flex items-center gap-2">
            <GroupSelector
              groups={groups}
              activeGroupId={activeGroupId}
              onSelectGroup={(id) => {
                setActiveGroup(id);
                uiState.setShowGroupPicker(false);
              }}
              showPicker={uiState.showGroupPicker}
              onTogglePicker={() => uiState.setShowGroupPicker(!uiState.showGroupPicker)}
              pickerRef={groupPickerRef}
            />
          </div>

          <SearchBar
            show={uiState.showSearch}
            value={uiState.searchQuery}
            onChange={uiState.setSearchQuery}
            onClear={() => uiState.setSearchQuery('')}
          />
        </div>
      )}

      {/* Progress view */}
      {uiState.panelView === 'progress' && (
        <div className="flex-1 overflow-hidden">
          <ProgressContent compact />
        </div>
      )}

      {/* Tasks view */}
      {uiState.panelView === 'tasks' && (
        <TaskListView
          {...taskData}
          allTasks={tasks}
          sensors={sensors}
          customCollisionDetection={customCollisionDetection}
          activeId={activeId}
          onDragStart={handleDragStart}
          onDragMove={wrappedHandleDragMove}
          onDragOver={handleDragOver}
          onDragEnd={wrappedHandleDragEnd}
          isOverCalendar={isOverCalendar}
          onToggle={toggleTask}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onAddSubTask={handleAddSubTask}
          onToggleCollapse={toggleCollapse}
          archiveCompletedTasks={archiveCompletedTasks}
          deleteCompletedTasks={deleteCompletedTasks}
          scheduledExpanded={uiState.scheduledExpanded}
          onToggleScheduledExpanded={() => uiState.setScheduledExpanded(!uiState.scheduledExpanded)}
          completedExpanded={uiState.completedExpanded}
          onToggleCompletedExpanded={() => uiState.setCompletedExpanded(!uiState.completedExpanded)}
          showCompletedMenu={uiState.showCompletedMenu}
          onToggleCompletedMenu={() => uiState.setShowCompletedMenu(!uiState.showCompletedMenu)}
          completedMenuRef={completedMenuRef}
          activeGroupId={activeGroupId}
          isExpanded={isExpanded}
          hourHeight={hourHeight}
        />
      )}

      {/* SubTask modal */}
      <SubTaskModal
        show={uiState.addingSubTaskFor !== null}
        content={uiState.subTaskContent}
        onContentChange={uiState.setSubTaskContent}
        onSubmit={handleSubmitSubTask}
        onClose={() => uiState.setAddingSubTaskFor(null)}
      />
    </div>
  );
}
