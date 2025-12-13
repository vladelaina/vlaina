import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Group, StoreTask } from '@/stores/types';
import { formatDuration } from '@/lib/dateUtils';
import { ArchiveStats } from './types';

interface ArchiveGroupSectionProps {
  dateKey: string;
  group: Group;
  groupTasks: StoreTask[];
  expandedGroups: Set<string>;
  toggleGroupExpanded: (dateKey: string, groupId: string) => void;
  showGroupMenu: string | null;
  setShowGroupMenu: (key: string | null) => void;
  deleteTask: (id: string) => void;
  renderTaskItem: (task: StoreTask, level: number) => React.ReactNode;
}

export function ArchiveGroupSection({
  dateKey,
  group,
  groupTasks,
  expandedGroups,
  toggleGroupExpanded,
  showGroupMenu,
  setShowGroupMenu,
  deleteTask,
  renderTaskItem
}: ArchiveGroupSectionProps) {
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const groupKey = `${dateKey}-${group.id}`;
  const groupExpanded = expandedGroups.has(groupKey);

  // Close group menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showGroupMenu === groupKey && groupMenuRef.current && !groupMenuRef.current.contains(event.target as Node)) {
        setShowGroupMenu(null);
      }
    };

    if (showGroupMenu === groupKey) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showGroupMenu, groupKey, setShowGroupMenu]);

  const handleDeleteGroupInDate = useCallback(() => {
    groupTasks.forEach(task => {
      deleteTask(task.id);
    });
    setShowGroupMenu(null);
  }, [groupTasks, deleteTask, setShowGroupMenu]);

  const calculateStats = (taskList: StoreTask[]): ArchiveStats => {
    const count = taskList.length;
    const estimated = taskList.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
    const actual = taskList.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    return { count, estimated, actual };
  };

  const groupStats = calculateStats(groupTasks);

  return (
    <div className="space-y-1">
      {/* Group header */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={() => toggleGroupExpanded(dateKey, group.id)}
          className="flex items-center gap-1.5 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          {groupExpanded ? (
            <ChevronDown className="h-3 w-3 text-zinc-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-zinc-400" />
          )}
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {group.name}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-600">
            ({groupStats.count}
            {groupStats.estimated > 0 && ` · ${formatDuration(groupStats.estimated)}`}
            {groupStats.actual > 0 && ` · ${formatDuration(groupStats.actual)}`})
          </span>
        </button>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
        
        {/* Group menu */}
        {groupTasks.length > 0 && (
          <div className="relative" ref={groupMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowGroupMenu(showGroupMenu === groupKey ? null : groupKey);
              }}
              className={`p-1 rounded-md transition-colors ${
                showGroupMenu === groupKey
                  ? 'text-zinc-400 bg-zinc-100 dark:text-zinc-500 dark:bg-zinc-800' 
                  : 'text-zinc-300 hover:text-zinc-400 dark:text-zinc-700 dark:hover:text-zinc-500'
              }`}
              aria-label="Group options"
            >
              <MoreHorizontal className="size-3" />
            </button>
            {showGroupMenu === groupKey && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50">
                <button
                  onClick={handleDeleteGroupInDate}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Delete All
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Group tasks */}
      {groupExpanded && (
        <div className="ml-4 space-y-0.5">
          {groupTasks.length > 0 ? (
            <div className="opacity-60">
              {groupTasks.map(task => renderTaskItem(task, 0))}
            </div>
          ) : (
            <div className="text-xs text-zinc-400 dark:text-zinc-600 italic py-1">
              No tasks
            </div>
          )}
        </div>
      )}
    </div>
  );
}
