import { useMemo } from 'react';
import type { NekoEvent } from '@/lib/ics/types';
import { cn } from '@/lib/utils';
import { collectUniqueTags, countTasksByTag } from '@/lib/tags/tagUtils';

interface TagFilterListProps {
  tasks: NekoEvent[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export function TagFilterList({ tasks, selectedTag, onSelectTag }: TagFilterListProps) {
  const topLevelTasks = useMemo(() => tasks.filter(task => !task.parentId), [tasks]);
  const tags = useMemo(() => collectUniqueTags(topLevelTasks), [topLevelTasks]);

  if (tags.length === 0 && selectedTag === null) {
    return null;
  }

  const allCount = topLevelTasks.length;

  return (
    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
      <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wide">
        Labels
      </div>

      <div className="flex flex-col gap-1">
        <button
          onClick={() => onSelectTag(null)}
          className={cn(
            'w-full px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors',
            selectedTag === null
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
              : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          )}
        >
          <span>All</span>
          <span className="text-[10px] text-zinc-400">{allCount}</span>
        </button>

        {tags.map(tag => {
          const count = countTasksByTag(topLevelTasks, tag);
          const active = selectedTag?.toLocaleLowerCase() === tag.toLocaleLowerCase();
          return (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              className={cn(
                'w-full px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors',
                active
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              <span className="truncate pr-2">#{tag}</span>
              <span className="text-[10px] text-zinc-400">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
