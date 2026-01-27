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
        selectedDate
    } = useCalendarStore();

    const { selectedColors, taskSortMode, setAppViewMode } = useUIStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [datePickerOpen, setDatePickerOpen] = useState(false);

    const isTodayView = isSameDay(selectedDate, new Date());
    const viewTitle = isTodayView ? "Today" : format(selectedDate, "MMMM d");

    // 1. Filter Tasks (which now include Calendar Events via Adapter)
    const filteredTasks = useMemo(() => {
        const targetDateKey = formatDateKey(selectedDate);

        return tasks.filter(t => {
            if (t.parentId) return false;
            if (!selectedColors.includes(t.color || 'default')) return false;
            // Only show items with a startDate that matches the selected date
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

    // 2. Sort
    const displayTasks = useMemo(() => {
        return sortTasks(filteredTasks, taskSortMode);
    }, [filteredTasks, taskSortMode]);

    // 3. Action Handlers (Direct mapping to GroupStore actions)
    // No need for 'CAL_' prefix handling as useGroupStore handles IDs natively
    
    // 4. Header Actions (Date Picker + Jump)
    const headerActions = (
        <div className="flex items-center gap-2">
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                    <button 
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent transition-colors text-zinc-600 dark:text-zinc-300 text-sm font-medium group"
                        title="Change Date"
                    >
                        <Calendar className="w-4 h-4 text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors" />
                        <span>{isTodayView ? "Today" : format(selectedDate, "MMM d")}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start" sideOffset={8}>
                    <MiniCalendar onSelect={() => setDatePickerOpen(false)} />
                </PopoverContent>
            </Popover>

            <button
                onClick={() => setAppViewMode('calendar')}
                className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent transition-colors text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
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
            
            // Pass simple action handlers
            onToggleTask={toggleTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
            onUpdateTaskIcon={updateTaskIcon}

            // Pass header controls
            headerControls={headerActions}
        />
    );
}
