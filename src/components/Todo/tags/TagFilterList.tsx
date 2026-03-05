import { useMemo } from 'react';
import type { NekoEvent } from '@/lib/ics/types';
import { cn } from '@/lib/utils';
import {
  collectUniqueTags,
  isTodaySystemTag,
  isWeekSystemTag,
  matchesSelectedTag,
  SYSTEM_TAG_TODAY,
  SYSTEM_TAG_WEEK,
} from '@/lib/tags/tagUtils';

interface TagFilterListProps {
  tasks: NekoEvent[];
  availableTags?: string[];
  todayCount?: number;
  weekCount?: number;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

const CHIP_SPAN_CLASS: Record<1 | 2 | 3, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
};

function getChipSpan(label: string): 1 | 2 | 3 {
  const length = label.trim().length;
  if (length <= 6) return 1;
  if (length <= 14) return 2;
  return 3;
}

export function TagFilterList({
  tasks,
  availableTags,
  todayCount,
  weekCount,
  selectedTag,
  onSelectTag,
}: TagFilterListProps) {
  const topLevelTasks = useMemo(() => tasks.filter(task => !task.parentId), [tasks]);
  const tags = useMemo(
    () => (availableTags ? [...availableTags] : collectUniqueTags(topLevelTasks)),
    [availableTags, topLevelTasks]
  );
  const todayTaskCount = useMemo(
    () => todayCount ?? topLevelTasks.filter(task => matchesSelectedTag(task, SYSTEM_TAG_TODAY)).length,
    [todayCount, topLevelTasks]
  );
  const weekTaskCount = useMemo(
    () => weekCount ?? topLevelTasks.filter(task => matchesSelectedTag(task, SYSTEM_TAG_WEEK)).length,
    [weekCount, topLevelTasks]
  );
  const todayActive = isTodaySystemTag(selectedTag);
  const weekActive = isWeekSystemTag(selectedTag);

  if (tags.length === 0 && todayTaskCount === 0 && weekTaskCount === 0 && selectedTag === null) {
    return null;
  }

  return (
    <div className="mt-2">
      <div className="grid grid-cols-3 grid-flow-row-dense gap-1.5">
        <button
          onClick={() => onSelectTag(null)}
          className={cn(
            'min-h-8 min-w-0 px-2 py-1 rounded-xl text-[12px] font-medium text-center leading-tight whitespace-normal break-words transition-colors',
            CHIP_SPAN_CLASS[getChipSpan('ALL')],
            selectedTag === null
              ? 'bg-amber-300 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
              : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
          )}
          title="ALL"
        >
          ALL
        </button>

        {(todayTaskCount > 0 || todayActive) && (
          <button
            onClick={() => onSelectTag(SYSTEM_TAG_TODAY)}
            className={cn(
              'min-h-8 min-w-0 px-2 py-1 rounded-xl text-[12px] font-medium text-center leading-tight whitespace-normal break-words transition-colors',
              CHIP_SPAN_CLASS[getChipSpan('Today')],
              todayActive
                ? 'bg-amber-300 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
                : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
            )}
            title="Today"
          >
            Today
          </button>
        )}

        {(weekTaskCount > 0 || weekActive) && (
          <button
            onClick={() => onSelectTag(SYSTEM_TAG_WEEK)}
            className={cn(
              'min-h-8 min-w-0 px-2 py-1 rounded-xl text-[12px] font-medium text-center leading-tight whitespace-normal break-words transition-colors',
              CHIP_SPAN_CLASS[getChipSpan('Week')],
              weekActive
                ? 'bg-amber-300 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
                : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
            )}
            title="This Week"
          >
            Week
          </button>
        )}

        {tags.map(tag => {
          const displayLabel = `#${tag}`;
          const active = selectedTag?.toLocaleLowerCase() === tag.toLocaleLowerCase();
          return (
            <button
              key={tag}
              onClick={() => onSelectTag(tag)}
              className={cn(
                'min-h-8 min-w-0 px-2 py-1 rounded-xl text-[12px] font-medium text-center leading-tight whitespace-normal break-words transition-colors',
                CHIP_SPAN_CLASS[getChipSpan(displayLabel)],
                active
                  ? 'bg-amber-300 text-amber-950 dark:bg-amber-400 dark:text-amber-950'
                  : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600'
              )}
              title={displayLabel}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
