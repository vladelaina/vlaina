/**
 * NoteOutline - Table of contents for current note
 * 
 * Displays heading structure like Obsidian's outline view
 */

import { useMemo } from 'react';
import { ListBulletsIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface HeadingItem {
  level: number;
  text: string;
  id: string;
}

interface NoteOutlineProps {
  content: string;
  onHeadingClick?: (id: string) => void;
}

export function NoteOutline({ content, onHeadingClick }: NoteOutlineProps) {
  // Parse headings from markdown content
  const headings = useMemo(() => {
    const lines = content.split('\n');
    const items: HeadingItem[] = [];
    
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        items.push({
          level,
          text,
          id: `heading-${index}`,
        });
      }
    });
    
    return items;
  }, [content]);

  if (headings.length === 0) {
    return (
      <div className="p-4 text-center">
        <ListBulletsIcon className="size-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" weight="duotone" />
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          No headings found
        </p>
      </div>
    );
  }

  // Find minimum level for proper indentation
  const minLevel = Math.min(...headings.map(h => h.level));

  return (
    <div className="py-2">
      <div className="px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        Outline
      </div>
      <nav className="space-y-0.5">
        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => onHeadingClick?.(heading.id)}
            style={{ paddingLeft: `${(heading.level - minLevel) * 12 + 12}px` }}
            className={cn(
              "w-full py-1 pr-3 text-left text-xs truncate transition-colors",
              "text-zinc-600 dark:text-zinc-400",
              "hover:text-zinc-900 dark:hover:text-zinc-200",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            {heading.text}
          </button>
        ))}
      </nav>
    </div>
  );
}
