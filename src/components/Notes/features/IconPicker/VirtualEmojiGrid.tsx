/**
 * VirtualEmojiGrid - Virtualized emoji grid with recent section
 */

import { useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  EMOJI_PER_ROW, 
  EMOJI_SIZE, 
  ROW_GAP, 
  EMOJI_MAP,
  SCROLLBAR_CLASSNAME,
  type EmojiItem,
} from './constants';

const EmojiRow = memo(function EmojiRow({ emojis }: { emojis: string[] }) {
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
});

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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'title' ? 28 : EMOJI_SIZE + ROW_GAP,
    overscan: 8,
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    if (button) {
      const emoji = button.dataset.emoji;
      if (emoji) onSelect(emoji);
    }
  }, [onSelect]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    const emoji = button?.dataset.emoji || null;
    if (emoji !== lastPreviewRef.current) {
      lastPreviewRef.current = emoji;
      onPreview?.(emoji);
    }
  }, [onPreview]);

  const handleMouseLeave = useCallback(() => {
    lastPreviewRef.current = null;
    onPreview?.(null);
  }, [onPreview]);

  return (
    <div
      ref={parentRef}
      className={`h-[280px] overflow-auto ${SCROLLBAR_CLASSNAME}`}
      style={{ contain: 'strict', willChange: 'scroll-position' }}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'title' ? 28 : EMOJI_SIZE + ROW_GAP,
    overscan: 8,
  });

  const lastPreviewRef = useRef<string | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    if (button?.dataset.emoji) {
      onSelect(button.dataset.emoji);
    }
  }, [onSelect]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    const emoji = button?.dataset.emoji || null;
    if (emoji !== lastPreviewRef.current) {
      lastPreviewRef.current = emoji;
      onPreview?.(emoji);
    }
  }, [onPreview]);

  const handleMouseLeave = useCallback(() => {
    lastPreviewRef.current = null;
    onPreview?.(null);
  }, [onPreview]);

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
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
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
