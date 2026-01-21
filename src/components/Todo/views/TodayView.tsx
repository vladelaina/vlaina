import { useState, useMemo, useCallback } from 'react';
import { useGroupStore } from '@/stores/useGroupStore';
import { useUIStore } from '@/stores/uiSlice';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { sortTasks } from '@/components/common/TaskList';
import { formatDateKey } from '@/lib/date';
import { TaskListView } from './TaskListView';
import { isSameDay, format } from 'date-fns';
import { Calendar, ArrowUpRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MiniCalendar } from '@/components/Calendar/features/DateSelector/MiniCalendar';

/**
 * TodayView - Shows tasks scheduled for a specific date (defaults to Today).
 * Integrates Calendar Events and allows date switching.
 */
export function TodayView() {
    const { tasks, toggleTask, updateTask, deleteTask, updateTaskIcon } = useGroupStore();
    const { 
        selectedDate,
        events: calendarEvents, 
        toggleComplete: toggleEventComplete,
        updateEvent,
        deleteEvent
    } = useCalendarStore();

    const { selectedColors, taskSortMode, setAppViewMode } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [datePickerOpen, setDatePickerOpen] = useState(false);

    const isTodayView = isSameDay(selectedDate, new Date());
    const viewTitle = isTodayView ? "Today" : format(selectedDate, "MMMM d");

    // 1. Filter Regular Tasks
    const filteredTasks = useMemo(() => {
        const targetDateKey = formatDateKey(selectedDate);

        return tasks.filter(t => {
            if (t.parentId) return false;
            if (!selectedColors.includes(t.color || 'default')) return false;
            if (!t.startDate) return false;

            const taskDateKey = formatDateKey(new Date(t.startDate));
            if (taskDateKey !== targetDateKey) return false;

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                if (!t.content.toLowerCase().includes(query)) return false;
            }
            return true;
        });
    }, [tasks, selectedColors, searchQuery, selectedDate]);

    // 2. Filter & Adapt Calendar Events
    const calendarTasks = useMemo(() => {
        return calendarEvents
            .filter(e => {
                // Check date
                if (!isSameDay(e.dtstart, selectedDate)) return false;

                // Apply filters
                if (!selectedColors.includes(e.color || 'default')) return false;
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    if (!e.summary.toLowerCase().includes(query)) return false;
                }
                return true;
            })
            .map(e => ({
                // Adapter: NekoEvent -> Task
                id: `CAL_${e.uid}`,
                originalId: e.uid,
                content: e.summary || 'Untitled Event',
                completed: e.completed,
                color: e.color,
                icon: e.icon,
                
                // Time
                startDate: e.dtstart.getTime(),
                endDate: e.dtend.getTime(),
                isAllDay: e.allDay,
                estimatedMinutes: 0,
                
                // Defaults
                parentId: null,
                order: -1, // Will be sorted by time anyway
                createdAt: e.dtstart.getTime(),
                updatedAt: Date.now(),
                groupId: 'calendar',
                collapsed: false,
                
                // Flag for UI customization if needed
                isCalendarEvent: true,
            }));
    }, [calendarEvents, selectedColors, searchQuery, selectedDate]);

    // 3. Merge & Sort
    const displayTasks = useMemo(() => {
        const combined = [...calendarTasks, ...filteredTasks] as any[];
        return sortTasks(combined, taskSortMode);
    }, [calendarTasks, filteredTasks, taskSortMode]);

    // 4. Action Handlers
    const handleToggle = useCallback((id: string) => {
        if (id.startsWith('CAL_')) {
            toggleEventComplete(id.replace('CAL_', ''));
        } else {
            toggleTask(id);
        }
    }, [toggleEventComplete, toggleTask]);

    const handleUpdate = useCallback((id: string, content: string) => {
        if (id.startsWith('CAL_')) {
            updateEvent(id.replace('CAL_', ''), { summary: content });
        } else {
            updateTask(id, content);
        }
    }, [updateEvent, updateTask]);

    const handleDelete = useCallback((id: string) => {
        if (id.startsWith('CAL_')) {
            deleteEvent(id.replace('CAL_', ''));
        } else {
            deleteTask(id);
        }
    }, [deleteEvent, deleteTask]);

    const handleUpdateIcon = useCallback((id: string, icon: string) => {
        if (id.startsWith('CAL_')) {
            updateEvent(id.replace('CAL_', ''), { icon });
        } else {
            updateTaskIcon(id, icon);
        }
    }, [updateEvent, updateTaskIcon]);

    // 5. Bottom Actions (Date Picker + Jump)
    const bottomActions = (
        <div className="flex items-center gap-2">
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                    <button 
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors text-zinc-600 dark:text-zinc-300 text-sm font-medium"
                        title="Change Date"
                    >
                        <Calendar className="w-4 h-4 text-zinc-400" />
                        <span>{isTodayView ? "Today" : format(selectedDate, "MMM d")}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 mb-2" align="start" sideOffset={8}>
                    <MiniCalendar onSelect={() => setDatePickerOpen(false)} />
                </PopoverContent>
            </Popover>

            <button
                onClick={() => setAppViewMode('calendar')}
                className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                title="Open in Calendar View"
            >
                <ArrowUpRight className="w-4 h-4" />
            </button>
        </div>
    );

    return (
        <TaskListView
            title={viewTitle}
            tasks={displayTasks}
            allTasks={tasks} 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showScheduledSection={false} 
            
            // Pass action overrides
            onToggleTask={handleToggle}
            onUpdateTask={handleUpdate}
            onDeleteTask={handleDelete}
            onUpdateTaskIcon={handleUpdateIcon}

            // Pass bottom actions
            bottomActions={bottomActions}
        />
    );
}
