import { useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Group, StoreTask } from '@/stores/types';
import { formatTimeRangeDisplay, formatDuration, TimeView } from '@/lib/dateUtils';
import { ArchiveGroupSection } from './ArchiveGroupSection';
import { ArchiveStats } from './types';

interface ArchiveDateGroupProps {
  dateKey: string;
  groupsInDate: Record<string, StoreTask[]>;
  allGroups: Group[];
  timeView: TimeView;
  expandedDates: Set<string>;
  toggleDateExpanded: (dateKey: string) => void;
  expandedGroups: Set<string>;
  toggleGroupExpanded: (dateKey: string, groupId: string) => void;
  showDateMenu: string | null;
  setShowDateMenu: (key: string | null) => void;
  showGroupMenu: string | null;
  setShowGroupMenu: (key: string | null) => void;
  deleteTask: (id: string) => void;
  renderTaskItem: (task: StoreTask, level: number) => React.ReactNode;
}

export function ArchiveDateGroup({
  dateKey,
  groupsInDate,
  allGroups,
  timeView,
  expandedDates,
  toggleDateExpanded,
  expandedGroups,
  toggleGroupExpanded,
  showDateMenu,
  setShowDateMenu,
  showGroupMenu,
  setShowGroupMenu,
  deleteTask,
  renderTaskItem
}: ArchiveDateGroupProps) {
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const dateExpanded = expandedDates.has(dateKey);
  const allTasksInDate = Object.values(groupsInDate).flat();

  // Close date menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDateMenu === dateKey && dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) {
        setShowDateMenu(null);
      }
    };

    if (showDateMenu === dateKey) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDateMenu, dateKey, setShowDateMenu]);

  const handleDeleteDate = useCallback(() => {
    Object.values(groupsInDate).forEach(taskList => {
      taskList.forEach(task => {
        deleteTask(task.id);
      });
    });
    setShowDateMenu(null);
  }, [groupsInDate, deleteTask, setShowDateMenu]);

  const calculateStats = (taskList: StoreTask[]): ArchiveStats => {
    const count = taskList.length;
    const estimated = taskList.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
    const actual = taskList.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    return { count, estimated, actual };
  };

  const dateStats = calculateStats(allTasksInDate);

  return (
    <div className="space-y-2">
      {/* Date header */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={() => toggleDateExpanded(dateKey)}
          className="flex items-center gap-1.5 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          {dateExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {formatTimeRangeDisplay(dateKey, timeView)}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-600">
            ({dateStats.count} tasks
            {dateStats.estimated > 0 && ` · Est. ${formatDuration(dateStats.estimated)}`}
            {dateStats.actual > 0 && ` · Act. ${formatDuration(dateStats.actual)}`})
          </span>
        </button>
        <div className="flex-1 h-px bg-border" />
        
        {/* Date menu */}
        <div className="relative" ref={dateMenuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDateMenu(showDateMenu === dateKey ? null : dateKey);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              showDateMenu === dateKey
                ? 'text-zinc-400 bg-zinc-100 dark:text-zinc-500 dark:bg-zinc-800' 
                : 'text-zinc-200 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500'
            }`}
            aria-label="More options"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {showDateMenu === dateKey && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50">
              <button
                onClick={handleDeleteDate}
                className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Delete All
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Date content: groups */}
      {dateExpanded && (
        <div className="ml-4 space-y-3">
          {allGroups.filter(g => g.id !== '__archive__').map(group => {
            const groupTasks = groupsInDate[group.id] || [];
            
            // Skip empty groups in week/month view
            if (timeView !== 'day' && groupTasks.length === 0) {
              return null;
            }
            
            return (
              <ArchiveGroupSection
                key={group.id}
                dateKey={dateKey}
                group={group}
                groupTasks={groupTasks}
                expandedGroups={expandedGroups}
                toggleGroupExpanded={toggleGroupExpanded}
                showGroupMenu={showGroupMenu}
                setShowGroupMenu={setShowGroupMenu}
                deleteTask={deleteTask}
                renderTaskItem={renderTaskItem}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
