import { useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, DragMoveEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '@/stores/types';
import { TaskInput, SortableDivider } from '@/components/common/TaskList';
import { TaskSection } from '../components/TaskSection';
import { cn } from '@/lib/utils';
import { getAllDayInlineStyles, getColorHex } from '@/lib/colors';

interface TaskListViewProps {
    // Task data
    incompleteTasks: Task[];
    scheduledTasks: Task[];
    completedTasks: Task[];
    incompleteTaskIds: string[];
    scheduledTaskIds: string[];
    completedTaskIds: string[];
    allTasks: Task[];

    // DnD
    sensors: any;
    customCollisionDetection: any;
    activeId: string | null;
    onDragStart: (event: any) => void;
    onDragMove: (event: DragMoveEvent) => void;
    onDragOver: (event: any) => void;
    onDragEnd: (event: any) => void;
    isOverCalendar: boolean;

    // Actions
    onToggle: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onAddSubTask: (parentId: string) => void;
    onToggleCollapse: (id: string) => void;
    archiveCompletedTasks: (groupId: string) => void;
    deleteCompletedTasks: (groupId: string) => void;

    // UI state
    scheduledExpanded: boolean;
    onToggleScheduledExpanded: () => void;
    completedExpanded: boolean;
    onToggleCompletedExpanded: () => void;
    showCompletedMenu: boolean;
    onToggleCompletedMenu: () => void;
    completedMenuRef: React.RefObject<HTMLDivElement>;

    // Other
    activeGroupId: string;
    isExpanded: boolean;
    hourHeight: number;
}

const SCHEDULED_DIVIDER_ID = '__divider_scheduled__';
const COMPLETED_DIVIDER_ID = '__divider_completed__';

export function TaskListView({
    incompleteTasks,
    scheduledTasks,
    completedTasks,
    incompleteTaskIds,
    scheduledTaskIds,
    completedTaskIds,
    allTasks,
    sensors,
    customCollisionDetection,
    activeId,
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
    isOverCalendar,
    onToggle,
    onUpdate,
    onDelete,
    onAddSubTask,
    onToggleCollapse,
    archiveCompletedTasks,
    deleteCompletedTasks,
    scheduledExpanded,
    onToggleScheduledExpanded,
    completedExpanded,
    onToggleCompletedExpanded,
    showCompletedMenu,
    onToggleCompletedMenu,
    completedMenuRef,
    activeGroupId,
    isExpanded,
    hourHeight,
}: TaskListViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

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

    return (
        <>
            {/* Task input */}
            {activeGroupId !== '__archive__' && (
                <div className="flex-shrink-0 px-3 pb-2">
                    <TaskInput compact={!isExpanded} />
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
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragOver={onDragOver}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={allSortableIds}
                        strategy={verticalListSortingStrategy}
                    >
                        {/* Incomplete tasks */}
                        {incompleteTasks.length > 0 ? (
                            <TaskSection
                                tasks={incompleteTasks}
                                allTasks={allTasks}
                                activeId={activeId}
                                onToggle={onToggle}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onAddSubTask={onAddSubTask}
                                onToggleCollapse={onToggleCollapse}
                            />
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
                                onToggleExpand={onToggleScheduledExpanded}
                            />
                        )}

                        {/* Scheduled tasks */}
                        {scheduledTasks.length > 0 && scheduledExpanded && (
                            <TaskSection
                                tasks={scheduledTasks}
                                allTasks={allTasks}
                                activeId={activeId}
                                onToggle={onToggle}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onAddSubTask={onAddSubTask}
                                onToggleCollapse={onToggleCollapse}
                            />
                        )}

                        {/* Completed tasks divider */}
                        {completedTasks.length > 0 && (
                            <SortableDivider
                                id={COMPLETED_DIVIDER_ID}
                                label="Completed"
                                count={completedTasks.length}
                                expanded={completedExpanded}
                                onToggleExpand={onToggleCompletedExpanded}
                                showMenu={showCompletedMenu}
                                onMenuToggle={onToggleCompletedMenu}
                                menuRef={completedMenuRef}
                                menuContent={
                                    activeGroupId !== '__archive__' ? (
                                        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50">
                                            <button
                                                onClick={() => {
                                                    if (activeGroupId) {
                                                        archiveCompletedTasks(activeGroupId);
                                                    }
                                                    onToggleCompletedMenu();
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
                                                    onToggleCompletedMenu();
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
                                <TaskSection
                                    tasks={completedTasks}
                                    allTasks={allTasks}
                                    activeId={activeId}
                                    onToggle={onToggle}
                                    onUpdate={onUpdate}
                                    onDelete={onDelete}
                                    onAddSubTask={onAddSubTask}
                                    onToggleCollapse={onToggleCollapse}
                                />
                            </div>
                        )}
                    </SortableContext>

                    {/* Drag Overlay */}
                    {createPortal(
                        <DragOverlay dropAnimation={null} className="cursor-grabbing" style={{ zIndex: 999999 }}>
                            {activeId ? (() => {
                                const task = allTasks.find(t => t.id === activeId);
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
                                        <div
                                            className={cn(
                                                "flex-shrink-0 w-[18px] h-[18px] rounded-sm mt-0.5",
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
    );
}