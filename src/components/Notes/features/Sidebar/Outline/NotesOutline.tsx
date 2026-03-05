import { cn } from '@/lib/utils';
import { useNotesOutline } from './useNotesOutline';

interface NotesOutlineProps {
  enabled: boolean;
  className?: string;
}

export function NotesOutline({ enabled, className }: NotesOutlineProps) {
  const { headings, activeId, jumpToHeading } = useNotesOutline(enabled);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex-1 overflow-auto neko-scrollbar px-2 pb-4 pt-2">
        {headings.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-[var(--neko-text-tertiary)]">
            No headings in this note
          </div>
        ) : (
          <nav aria-label="Document outline" className="space-y-0.5">
            {headings.map((heading) => (
              <button
                key={heading.id}
                type="button"
                onClick={() => jumpToHeading(heading.id)}
                className={cn(
                  'w-full truncate rounded-md py-1.5 text-left text-[13px] transition-colors',
                  'hover:bg-[var(--neko-hover-filled)]',
                  heading.id === activeId
                    ? 'bg-[var(--neko-hover-filled)] text-[var(--neko-text-primary)]'
                    : 'text-[var(--neko-text-secondary)]',
                )}
                style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px`, paddingRight: '8px' }}
                title={heading.text}
              >
                {heading.text}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
