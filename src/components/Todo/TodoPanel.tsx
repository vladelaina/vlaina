import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Search, X } from 'lucide-react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { cn } from '@/lib/utils';
import { TaskInput, TaskItem } from '@/components/common/TaskList';
import { useTaskDragAndDrop } from '@/components/common/TaskList/useTaskDragAndDrop';
import { ProgressContent } from '@/components/Progress/features/ProgressContent';

// Refactored Hooks & Components
import { useTodoFiltering } from './hooks/useTodoFiltering';
import { TodoListSection } from './components/TodoListSection';

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
        setDraggingTaskId,
    } = useUIStore();

    const [panelView, setPanelView] = useState<'tasks' | 'progress'>('tasks');
    const [searchQuery, setSearchQuery] = useState('');
    const [scheduledExpanded, setScheduledExpanded] = useState(true);
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [showCompletedMenu, setShowCompletedMenu] = useState(false);
    
    // Subtask Modal State
    const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
    const [subTaskContent, setSubTaskContent] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    const completedMenuRef = useRef<HTMLDivElement>(null);

    // 1. Data Processing (via Hook)
    const { 
        incompleteTasks, 
        scheduledTasks, 
        completedTasks, 
        allSortableIds, 
        getChildren 
    } = useTodoFiltering({
        searchQuery,
        scheduledExpanded,
        completedExpanded
    });

    // 2. Drag and Drop Logic
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

    // 3. Handlers
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

    // 4. Render Logic (Recursive)
    const renderTaskItem = useCallback((task: typeof incompleteTasks[0], level: number = 0) => {
        const children = getChildren(task.id);
        const hasChildren = children.length > 0;
        const isBeingDragged = activeId === task.id;

        return (
            <div key={task.id}>
                <TaskItem
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
    }, [activeId, getChildren, toggleTask, updateTask, deleteTask, handleAddSubTask, toggleCollapse]);

    const SCHEDULED_DIVIDER_ID = '__divider_scheduled__';
    const COMPLETED_DIVIDER_ID = '__divider_completed__';

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

            {/* Content Area */}
            {panelView === 'progress' ? (
                <div className="flex-1 overflow-hidden p-6 max-w-4xl mx-auto w-full">
                    <ProgressContent />
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-shrink-0 px-6 py-4 max-w-3xl mx-auto w-full">
                        <TaskInput compact={false} />
                    </div>

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
                                    {/* Incomplete Tasks Section */}
                                    <TodoListSection
                                        items={incompleteTasks}
                                        renderItem={(task) => renderTaskItem(task, 0)}
                                        emptyState={
                                            scheduledTasks.length === 0 && completedTasks.length === 0 && (
                                                <div className="py-20 text-center">
                                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800 mb-4">
                                                        <Check className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                                                    </div>
                                                    <p className="text-zinc-400 dark:text-zinc-600 font-medium">No tasks in this list</p>
                                                    <p className="text-sm text-zinc-400/70 dark:text-zinc-600/70 mt-1">Add a task above to get started</p>
                                                </div>
                                            )
                                        }
                                    />

                                    {/* Scheduled Tasks Section */}
                                    <TodoListSection
                                        title="Scheduled"
                                        id={SCHEDULED_DIVIDER_ID}
                                        items={scheduledTasks}
                                        renderItem={(task) => renderTaskItem(task, 0)}
                                        isExpanded={scheduledExpanded}
                                        onToggleExpand={() => setScheduledExpanded(!scheduledExpanded)}
                                    />

                                    {/* Completed Tasks Section */}
                                    <TodoListSection
                                        title="Completed"
                                        id={COMPLETED_DIVIDER_ID}
                                        items={completedTasks}
                                        renderItem={(task) => renderTaskItem(task, 0)}
                                        isExpanded={completedExpanded}
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
