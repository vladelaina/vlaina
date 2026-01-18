import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Search, X } from 'lucide-react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { cn } from '@/lib/utils';
import { PanelTaskInput, PanelTaskItem, SortableDivider } from '@/components/common/TaskList';
import { useTaskDragAndDrop } from '@/components/common/TaskList/useTaskDragAndDrop';
import { ProgressContent } from '@/components/Progress/features/ProgressContent';
import { getColorPriority } from '@/lib/colors';

// Migrated logic from CalendarTaskPanel, adapted for full page
export function TodoPanel() {
    const {
        tasks,
        activeGroupId,
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
        setDraggingTaskId,
    } = useUIStore();

    // Full page view doesn't need 'viewMode' toggling inside the panel necessarily, 
    // but we keep 'tasks' vs 'progress' tabs for now as requested.
    const [panelView, setPanelView] = useState<'tasks' | 'progress'>('tasks');

    const [searchQuery, setSearchQuery] = useState('');
    const [scheduledExpanded, setScheduledExpanded] = useState(true);
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [showCompletedMenu, setShowCompletedMenu] = useState(false);
    const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
    const [subTaskContent, setSubTaskContent] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    const completedMenuRef = useRef<HTMLDivElement>(null);

    const {
        sensors,
        customCollisionDetection,
        activeId,
        handleDragStart,
        handleDragMove,
        handleDragOver,
        handleDragEnd,
    } = useTaskDragAndDrop({
        tasks,
        reorderTasks,
        updateTaskTime,
        toggleTask,
        setDraggingTaskId,
    });

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

        return {
            incompleteTasks: unscheduled,
            scheduledTasks: scheduled,
            completedTasks: (hideCompleted) ? [] : topLevelTasks.filter((t) => t.completed),
        };
    }, [tasks, activeGroupId, hideCompleted, selectedColors, searchQuery]);

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

        const isBeingDragged = activeId === task.id; // Simplified drag check for now

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


    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden relative">
            {/* Header: Tab switch + Search */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
                        <button
                            onClick={() => setPanelView('tasks')}
                            className={cn(
                                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
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
                                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                panelView === 'progress'
                                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            Progress
                        </button>
                    </div>

                    {/* Global Search Bar (Nice to have in page header) */}
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="w-full bg-zinc-100 dark:bg-zinc-800 pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress view */}
            {panelView === 'progress' && (
                <div className="flex-1 overflow-hidden p-6 max-w-4xl mx-auto w-full">
                    <ProgressContent />
                </div>
            )}

            {/* Tasks view */}
            {panelView === 'tasks' && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Input Area */}
                    <div className="flex-shrink-0 px-6 py-4 max-w-3xl mx-auto w-full">
                        <PanelTaskInput compact={false} />
                    </div>

                    {/* Task List - Centered Container for Focus */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-6 pb-20 scroll-smooth neko-scrollbar"
                    >
                        <div className="max-w-3xl mx-auto w-full pb-10">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={customCollisionDetection}
                                onDragStart={handleDragStart}
                                onDragMove={handleDragMove}
                                onDragOver={handleDragOver}
                                onDragEnd={handleDragEnd}
                            >
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
                                        <div className="py-20 text-center">
                                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800 mb-4">
                                                <Check className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                                            </div>
                                            <p className="text-zinc-400 dark:text-zinc-600 font-medium">No tasks in this list</p>
                                            <p className="text-sm text-zinc-400/70 dark:text-zinc-600/70 mt-1">Add a task above to get started</p>
                                        </div>
                                    ) : null}

                                    {/* Scheduled tasks divider */}
                                    {scheduledTasks.length > 0 && (
                                        <div className="mt-8">
                                            <SortableDivider
                                                id={SCHEDULED_DIVIDER_ID}
                                                label="Scheduled"
                                                count={scheduledTasks.length}
                                                expanded={scheduledExpanded}
                                                onToggleExpand={() => setScheduledExpanded(!scheduledExpanded)}
                                            />
                                            {scheduledExpanded && (
                                                <div className="space-y-2 mt-2">
                                                    {scheduledTasks.map(task => renderTaskItem(task, 0))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Completed tasks divider */}
                                    {completedTasks.length > 0 && (
                                        <div className="mt-8">
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
                                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50">
                                                        <button
                                                            onClick={() => {
                                                                if (activeGroupId) archiveCompletedTasks(activeGroupId);
                                                                setShowCompletedMenu(false);
                                                            }}
                                                            className="w-full px-3 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                        >
                                                            Archive All
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (activeGroupId) deleteCompletedTasks(activeGroupId);
                                                                setShowCompletedMenu(false);
                                                            }}
                                                            className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                        >
                                                            Delete All
                                                        </button>
                                                    </div>
                                                }
                                            />
                                            {completedExpanded && (
                                                <div className="space-y-2 opacity-60 mt-2">
                                                    {completedTasks.map(task => renderTaskItem(task, 0))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </SortableContext>

                                <DragOverlay dropAnimation={null} className="cursor-grabbing" style={{ zIndex: 999999 }}>
                                    {activeId ? (
                                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 opacity-90">
                                            Dragging item...
                                        </div>
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        </div>
                    </div>
                </div>
            )}

            {/* Subtask modal */}
            <AnimatePresence>
                {addingSubTaskFor && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setAddingSubTaskFor(null)}
                    >
                        {/* Reusing existing modal logic... simplified for brevity here */}
                        <div className="bg-white p-4 rounded-lg shadow-xl w-96" onClick={e => e.stopPropagation()}>
                            <h3 className="font-semibold mb-2">Add Subtask</h3>
                            <input
                                autoFocus
                                className="w-full border p-2 rounded mb-2"
                                value={subTaskContent}
                                onChange={e => setSubTaskContent(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSubmitSubTask();
                                    if (e.key === 'Escape') setAddingSubTaskFor(null);
                                }}
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setAddingSubTaskFor(null)} className="px-3 py-1 text-sm text-zinc-500">Cancel</button>
                                <button onClick={handleSubmitSubTask} className="px-3 py-1 text-sm bg-black text-white rounded">Add</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
