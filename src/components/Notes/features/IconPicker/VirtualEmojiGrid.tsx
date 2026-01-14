/**
 * VirtualEmojiGrid - Virtualized emoji grid with recent section
 */

import { useRef, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  EMOJI_PER_ROW, 
  EMOJI_SIZE, 
  ROW_GAP, 
  EMOJI_MAP,
  SCROLLBAR_CLASSNAME,
  type EmojiItem,
} from './constants';

interface EmojiRowProps {
  emojis: string[];
}

const EmojiRow = memo(
  function EmojiRow({ emojis }: EmojiRowProps) {
    return (
      <div className="px-2 grid grid-cols-9 gap-0.5">
        {emojis.map((emoji, i) => (
          <button
            key={i}
            data-emoji={emoji}
            className="w-full aspect-square flex items-center justify-center rounded-md text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  },
  (prev, next) => {
    // Compare emojis array content
    if (prev.emojis.length !== next.emojis.length) return false;
    for (let i = 0; i < prev.emojis.length; i++) {
      if (prev.emojis[i] !== next.emojis[i]) return false;
    }
    return true;
  }
);

interface VirtualEmojiGridProps {
  emojis: EmojiItem[];
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  recentEmojis: string[];
  categoryName: string;
}

export function VirtualEmojiGrid({
  emojis,
  skinTone,
  onSelect,
  onPreview,
  recentEmojis,
  categoryName,
}: VirtualEmojiGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Use ref to store callbacks
  const onPreviewRef = useRef(onPreview);
  const onSelectRef = useRef(onSelect);
  onPreviewRef.current = onPreview;
  onSelectRef.current = onSelect;
  
  const emojisWithSkin = useMemo(() => {
    return emojis.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [emojis, skinTone]);

  const recentWithSkin = useMemo(() => {
    return recentEmojis.map(emoji => {
      const item = EMOJI_MAP.get(emoji);
      if (!item) return emoji;
      if (skinTone === 0 || !item.skins || item.skins.length <= skinTone) {
        return item.native;
      }
      return item.skins[skinTone]?.native || item.native;
    });
  }, [recentEmojis, skinTone]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'emojis'; content: string | string[] }[] = [];
    
    if (recentWithSkin.length > 0) {
      result.push({ type: 'title', content: 'Recent' });
      for (let i = 0; i < recentWithSkin.length; i += EMOJI_PER_ROW) {
        result.push({ type: 'emojis', content: recentWithSkin.slice(i, i + EMOJI_PER_ROW) });
      }
    }
    
    result.push({ type: 'title', content: categoryName });
    for (let i = 0; i < emojisWithSkin.length; i += EMOJI_PER_ROW) {
      result.push({ type: 'emojis', content: emojisWithSkin.slice(i, i + EMOJI_PER_ROW) });
    }
    
    return result;
  }, [emojisWithSkin, recentWithSkin, categoryName]);

  const rowSizeGetter = useMemo(() => {
    return (index: number) => rows[index].type === 'title' ? 28 : EMOJI_SIZE + ROW_GAP;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: rowSizeGetter,
    overscan: 5,
  });

  useEffect(() => {
    if (categoryName === 'Smileys & People') {
      virtualizer.scrollToIndex(0, { align: 'start' });
    } else if (recentWithSkin.length > 0) {
      const recentRows = Math.ceil(recentWithSkin.length / EMOJI_PER_ROW) + 1;
      virtualizer.scrollToIndex(recentRows, { align: 'start' });
    } else {
      virtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [categoryName]);

  const lastPreviewRef = useRef<string | null>(null);

  // Use native event handling
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-emoji]') as HTMLElement;
      const emoji = button?.dataset.emoji || null;
      if (emoji !== lastPreviewRef.current) {
        lastPreviewRef.current = emoji;
        onPreviewRef.current?.(emoji);
      }
    };

    const handleMouseLeave = () => {
      if (lastPreviewRef.current !== null) {
        lastPreviewRef.current = null;
        onPreviewRef.current?.(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-emoji]') as HTMLElement;
      if (button?.dataset.emoji) {
        onSelectRef.current(button.dataset.emoji);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div
      ref={parentRef}
      className={`h-[280px] overflow-auto ${SCROLLBAR_CLASSNAME}`}
      style={{ contain: 'strict', willChange: 'scroll-position' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'title' ? (
                <div className="px-2 pt-2 pb-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  {row.content as string}
                </div>
              ) : (
                <EmojiRow emojis={row.content as string[]} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VirtualSearchResultsProps {
  results: EmojiItem[];
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
}

export function VirtualSearchResults({
  results,
  skinTone,
  onSelect,
  onPreview,
}: VirtualSearchResultsProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const lastPreviewRef = useRef<string | null>(null);

  // Use ref to store callbacks
  const onPreviewRef = useRef(onPreview);
  const onSelectRef = useRef(onSelect);
  onPreviewRef.current = onPreview;
  onSelectRef.current = onSelect;

  const emojisWithSkin = useMemo(() => {
    return results.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [results, skinTone]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'emojis'; content: string | string[] }[] = [];
    result.push({ type: 'title', content: `Results (${results.length})` });
    for (let i = 0; i < emojisWithSkin.length; i += EMOJI_PER_ROW) {
      result.push({ type: 'emojis', content: emojisWithSkin.slice(i, i + EMOJI_PER_ROW) });
    }
    return result;
  }, [emojisWithSkin, results.length]);

  const rowSizeGetter = useMemo(() => {
    return (index: number) => rows[index].type === 'title' ? 28 : EMOJI_SIZE + ROW_GAP;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: rowSizeGetter,
    overscan: 5,
  });

  // Use native event handling
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-emoji]') as HTMLElement;
      const emoji = button?.dataset.emoji || null;
      if (emoji !== lastPreviewRef.current) {
        lastPreviewRef.current = emoji;
        onPreviewRef.current?.(emoji);
      }
    };

    const handleMouseLeave = () => {
      if (lastPreviewRef.current !== null) {
        lastPreviewRef.current = null;
        onPreviewRef.current?.(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-emoji]') as HTMLElement;
      if (button?.dataset.emoji) {
        onSelectRef.current(button.dataset.emoji);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
    };
  }, []);

  if (results.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <div className="text-zinc-400 dark:text-zinc-500 text-sm">No emoji found</div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`h-[280px] overflow-auto ${SCROLLBAR_CLASSNAME}`}
      style={{ contain: 'strict', willChange: 'scroll-position' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'title' ? (
                <div className="px-2 pt-2 pb-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  {row.content as string}
                </div>
              ) : (
                <EmojiRow emojis={row.content as string[]} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
