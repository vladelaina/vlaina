import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { cn } from '@/lib/utils';
import { useGroupStore, useUIStore } from '@/stores/useGroupStore';
import { TaskInput, TaskItem, TaskDragContext, TaskSortMenu } from '@/components/common/TaskList';
import { TodoListSection } from './components/TodoListSection';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

interface TaskListViewProps {
    tasks: any[];
    allTasks: any[];
    completionMode?: 'active' | 'completed' | 'all';
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    onToggleTask?: (id: string) => void;
    onUpdateTask?: (id: string, content: string) => void;
    onDeleteTask?: (id: string) => void;
    onUpdateTaskIcon?: (id: string, icon: string) => void;
    headerControls?: React.ReactNode;
}

export function TaskListView({
    tasks: filteredTasks,
    allTasks,
    completionMode = 'active',
    searchQuery,
    setSearchQuery,
    onToggleTask,
    onUpdateTask,
    onDeleteTask,
    onUpdateTaskIcon,
    headerControls,
}: TaskListViewProps) {
    const groupStore = useGroupStore();
    
    const toggleTask = onToggleTask || groupStore.toggleTask;
    const updateTask = onUpdateTask || groupStore.updateTask;
    const deleteTask = onDeleteTask || groupStore.deleteTask;
    const updateTaskIcon = onUpdateTaskIcon;

    const {
        reorderTasks,
        addSubTask,
        toggleCollapse,
    } = groupStore;

    const { setDraggingTaskId, draggingTaskId } = useUIStore();
    
    // Controls the visibility of the search bar
    const [isSearchActive, setIsSearchActive] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
    const [subTaskContent, setSubTaskContent] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    // Listen for global search shortcut/button
    useGlobalSearch(() => {
        setIsSearchActive(prev => {
            if (prev) {
                setSearchQuery(''); // Clear query when toggling off
                return false;
            } else {
                setTimeout(() => searchInputRef.current?.focus(), 50);
                return true;
            }
        });
    });

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

    const visibleTasks = completionMode === 'completed'
        ? filteredTasks.filter(t => t.completed)
        : completionMode === 'all'
            ? filteredTasks
            : filteredTasks.filter(t => !t.completed);

    const getChildren = useCallback((parentId: string) => {
        return allTasks
            .filter(t => t.parentId === parentId)
            .sort((a, b) => a.order - b.order);
    }, [allTasks]);

    const allSortableIds = visibleTasks.map(t => t.uid);

    const renderTaskItem = useCallback((task: any, level: number = 0) => {
        const children = getChildren(task.uid);
        const hasChildren = children.length > 0;
        const isBeingDragged = draggingTaskId === task.uid;
        const isCalendarEvent = !!task.isCalendarEvent;

        return (
            <div key={task.uid}>
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
                    onToggleCollapse={() => toggleCollapse(task.uid)}
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
    }, [draggingTaskId, getChildren, toggleTask, updateTask, deleteTask, handleAddSubTask, toggleCollapse, updateTaskIcon]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden relative">
            {headerControls && (
                <div className="flex-shrink-0 px-8 py-3 flex items-center z-10 min-h-[52px]">
                    {headerControls}
                </div>
            )}

            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                <div className="flex-shrink-0 px-8 pb-4 pt-3 max-w-3xl mx-auto w-full">
                    <div className="relative">
                        <div className="-ml-8 pr-9">
                            {isSearchActive || searchQuery ? (
                                <div className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-md',
                                    'border border-zinc-200 dark:border-zinc-700 bg-muted/30'
                                )}>
     <Icon size="md" name="common.search" className="text-zinc-400 flex-shrink-0" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search tasks..."
                                        className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-0"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                                setSearchQuery('');
                                                setIsSearchActive(false);
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => { 
                                            setSearchQuery(''); 
                                            setIsSearchActive(false);
                                        }}
                                        className="flex-shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    >
     <Icon size="md" name="common.close" />
                                    </button>
                                </div>
                            ) : (
                                <TaskInput compact={false} />
                            )}
                        </div>
                        <div className="absolute right-0 top-0">
                            <TaskSortMenu />
                        </div>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-8 pb-20 scroll-smooth neko-scrollbar"
                >
                    <div className="max-w-3xl mx-auto w-full pb-10">
                        <TaskDragContext
                            allTasks={allTasks}
                            reorderTasks={reorderTasks}
                            toggleTask={toggleTask}
                            setDraggingTaskId={setDraggingTaskId}
                            getChildCount={(id) => getChildren(id).length}
                        >
                            <SortableContext
                                items={allSortableIds}
                                strategy={verticalListSortingStrategy}
                            >
                                <TodoListSection
                                    items={visibleTasks}
                                    renderItem={(task) => renderTaskItem(task, 0)}
                                    emptyState={
                                        visibleTasks.length === 0 && (
                                            <div className="py-24 text-center">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 mb-4">
                                                    <Icon name="common.check" className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                                                </div>
                                                <p className="text-zinc-400 dark:text-zinc-600 font-medium">All clear for now</p>
                                                <p className="text-sm text-zinc-400/60 dark:text-zinc-600/60 mt-1">Capture tasks above</p>
                                            </div>
                                        )
                                    }
                                />
                            </SortableContext>
                        </TaskDragContext>
                    </div>
                </div>
            </div>

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
