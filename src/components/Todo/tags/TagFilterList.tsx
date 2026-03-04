import { useMemo } from 'react';
import type { NekoEvent } from '@/lib/ics/types';
import { cn } from '@/lib/utils';
import { collectUniqueTags } from '@/lib/tags/tagUtils';

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

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectTag(null)}
          className={cn(
            'h-10 px-4 rounded-2xl text-[15px] font-medium transition-colors',
            selectedTag === null
              ? 'bg-amber-300 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
              : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
          )}
        >
          All Labels
        </button>

        {tags.map(tag => {
          const active = selectedTag?.toLocaleLowerCase() === tag.toLocaleLowerCase();
          return (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              className={cn(
                'h-10 px-4 rounded-2xl text-[15px] font-medium transition-colors',
                active
                  ? 'bg-amber-300 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
                  : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
              )}
            >
              #{tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
