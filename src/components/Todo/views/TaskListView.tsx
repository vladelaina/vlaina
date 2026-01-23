import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Search, X } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { cn } from '@/lib/utils';
import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { TaskInput, TaskItem, TaskDragContext } from '@/components/common/TaskList';
import { TodoListSection } from './components/TodoListSection';

interface TaskListViewProps {
    title: string;
    tasks: any[];
    allTasks: any[];
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    showScheduledSection?: boolean;
    // Action overrides
    onToggleTask?: (id: string) => void;
    onUpdateTask?: (id: string, content: string) => void;
    onDeleteTask?: (id: string) => void;
    onUpdateTaskIcon?: (id: string, icon: string) => void;
    headerControls?: React.ReactNode;
}

/**
 * Shared Task List View component.
 * Renders the common UI for Tasks, Today, and Inbox views.
 */
export function TaskListView({
    tasks: filteredTasks,
    allTasks,
    searchQuery,
    setSearchQuery,
    showScheduledSection = true,
    onToggleTask,
    onUpdateTask,
    onDeleteTask,
    onUpdateTaskIcon,
    headerControls,
}: TaskListViewProps) {
    const groupStore = useGroupStore();
    
    // Use provided handlers or fallback to store
    const toggleTask = onToggleTask || groupStore.toggleTask;
    const updateTask = onUpdateTask || groupStore.updateTask;
    const deleteTask = onDeleteTask || groupStore.deleteTask;
    const updateTaskIcon = onUpdateTaskIcon; // TaskItem defaults to store if this is undefined, but we need to pass it explicitly if we want to override

    const {
        reorderTasks,
        addSubTask,
        toggleCollapse,
        updateTaskTime,
        archiveCompletedTasks,
        deleteCompletedTasks,
        activeGroupId,
    } = groupStore;

    const { setDraggingTaskId, hideCompleted, draggingTaskId } = useUIStore();

    const [scheduledExpanded, setScheduledExpanded] = useState(true);
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const [showCompletedMenu, setShowCompletedMenu] = useState(false);
    
    // Search State
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Subtask Modal State
    const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
    const [subTaskContent, setSubTaskContent] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    const completedMenuRef = useRef<HTMLDivElement>(null);

    // Search Handlers
    const handleSearchClick = () => {
        setIsSearchExpanded(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const handleSearchBlur = () => {
        if (!searchQuery) {
            setIsSearchExpanded(false);
        }
    };

    // Handlers
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

    // Categorize tasks
    const incompleteTasks = filteredTasks.filter(t => {
        if (t.completed) return false;
        // If showing scheduled section, filter out scheduled tasks from here.
        // Otherwise (Today view), include them in the main list.
        if (showScheduledSection && t.startDate) return false;
        return true;
    });
    const scheduledTasks = showScheduledSection
        ? filteredTasks.filter(t => !t.completed && t.startDate)
        : [];
    const completedTasks = hideCompleted ? [] : filteredTasks.filter(t => t.completed);

    // Generate sortable IDs
    const SCHEDULED_DIVIDER_ID = '__divider_scheduled__';
    const COMPLETED_DIVIDER_ID = '__divider_completed__';

    const getChildren = useCallback((parentId: string) => {
        return allTasks
            .filter(t => t.parentId === parentId)
            .sort((a, b) => a.order - b.order);
    }, [allTasks]);

    const allSortableIds = [
        ...incompleteTasks.map(t => t.id),
        ...(scheduledTasks.length > 0 ? [SCHEDULED_DIVIDER_ID, ...(scheduledExpanded ? scheduledTasks.map(t => t.id) : [])] : []),
        ...(completedTasks.length > 0 ? [COMPLETED_DIVIDER_ID, ...(completedExpanded ? completedTasks.map(t => t.id) : [])] : []),
    ];

    // Render Logic (Recursive)
    const renderTaskItem = useCallback((task: any, level: number = 0) => {
        const children = getChildren(task.id);
        const hasChildren = children.length > 0;
        const isBeingDragged = draggingTaskId === task.id;
        const isCalendarEvent = !!task.isCalendarEvent;

        return (
            <div key={task.id}>
                <TaskItem
                    task={task}
                    onToggle={toggleTask}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                    onUpdateIcon={updateTaskIcon}
                    onAddSubTask={handleAddSubTask}
                    isBeingDragged={isBeingDragged}
                    level={level}
                    hasChildren={hasChildren}
                    collapsed={task.collapsed}
                    onToggleCollapse={() => toggleCollapse(task.id)}
                    // Disable drag and subtasks for calendar events
                    draggable={!isCalendarEvent}
                    allowSubtasks={!isCalendarEvent}
                />
                {hasChildren && !task.collapsed && (
                    <div className="ml-4">
                        {children.map(child => renderTaskItem(child, level + 1))}
                    </div>
                )}
            </div>
        );
    }, [draggingTaskId, getChildren, toggleTask, updateTask, deleteTask, handleAddSubTask, toggleCollapse]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden relative">
            {/* Header - Minimalist & Expandable */}
            <div className="flex-shrink-0 px-8 py-3 flex items-center justify-end z-10 min-h-[52px]">
                {/* Header Controls (Date Picker, etc.) */}
                {headerControls && (
                    <div className="mr-auto">
                        {headerControls}
                    </div>
                )}

                <motion.div 
                    initial={false}
                    animate={{ 
                        width: isSearchExpanded || searchQuery ? 240 : 40,
                    }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="relative flex items-center justify-end"
                >
                    <motion.div
                        className={cn(
                            "flex items-center overflow-hidden rounded-full transition-colors relative h-10",
                            isSearchExpanded || searchQuery 
                                ? "bg-zinc-100 dark:bg-zinc-800/50" 
                                : "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                        )}
                    >
                        {/* Search Icon / Toggle */}
                        <div 
                            className={cn(
                                "flex-shrink-0 w-10 h-10 flex items-center justify-center cursor-pointer z-10",
                                !isSearchExpanded && !searchQuery && "absolute right-0"
                            )}
                            onClick={handleSearchClick}
                        >
                            <Search className="w-4 h-4 text-zinc-500" />
                        </div>

                        {/* Input Field */}
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onBlur={handleSearchBlur}
                            placeholder="Search..."
                            className={cn(
                                "w-full bg-transparent border-none outline-none text-sm pr-2 placeholder:text-zinc-400 transition-opacity duration-300",
                                isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
                            )}
                        />
                        
                        {/* Clear Button */}
                        <AnimatePresence>
                            {searchQuery && (
                                <motion.button 
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                                    className="flex-shrink-0 w-8 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-600 z-10 mr-1"
                                >
                                    <X className="w-3 h-3" />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                <div className="flex-shrink-0 px-8 pb-4 max-w-3xl mx-auto w-full">
                    <TaskInput compact={false} />
                </div>

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-8 pb-20 scroll-smooth neko-scrollbar"
                >
                    <div className="max-w-3xl mx-auto w-full pb-10">
                        <TaskDragContext
                            allTasks={allTasks}
                            reorderTasks={reorderTasks}
                            updateTaskTime={updateTaskTime}
                            toggleTask={toggleTask}
                            setDraggingTaskId={setDraggingTaskId}
                            getChildCount={(id) => getChildren(id).length}
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
                                            <div className="py-24 text-center">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 mb-4">
                                                    <Check className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                                                </div>
                                                <p className="text-zinc-400 dark:text-zinc-600 font-medium">All clear for now</p>
                                                <p className="text-sm text-zinc-400/60 dark:text-zinc-600/60 mt-1">Capture tasks above</p>
                                            </div>
                                        )
                                    }
                                />

                                {/* Scheduled Tasks Section */}
                                {showScheduledSection && scheduledTasks.length > 0 && (
                                    <TodoListSection
                                        title="Scheduled"
                                        id={SCHEDULED_DIVIDER_ID}
                                        items={scheduledTasks}
                                        renderItem={(task) => renderTaskItem(task, 0)}
                                        isExpanded={scheduledExpanded}
                                        onToggleExpand={() => setScheduledExpanded(!scheduledExpanded)}
                                    />
                                )}

                                {/* Completed Tasks Section */}
                                {completedTasks.length > 0 && (
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
                                )}
                            </SortableContext>
                        </TaskDragContext>
                    </div>
                </div>
            </div>

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
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-2xl w-96" onClick={e => e.stopPropagation()}>
                            <h3 className="font-semibold mb-3 text-zinc-900 dark:text-zinc-100">Add Subtask</h3>
                            <input
                                autoFocus
                                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none outline-none p-3 rounded-lg mb-4 text-sm focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 transition-all"
                                value={subTaskContent}
                                onChange={e => setSubTaskContent(e.target.value)}
                                placeholder="What needs to be done?"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSubmitSubTask();
                                    if (e.key === 'Escape') setAddingSubTaskFor(null);
                                }}
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setAddingSubTaskFor(null)} className="px-4 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</button>
                                <button onClick={handleSubmitSubTask} className="px-4 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity">Add</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
