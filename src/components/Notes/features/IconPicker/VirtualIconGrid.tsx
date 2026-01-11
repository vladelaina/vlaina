/**
 * VirtualIconGrid - Virtualized icon grid with recent section
 */

import { useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ICON_PER_ROW, ICON_SIZE, ROW_GAP, ICON_MAP, SCROLLBAR_CLASSNAME } from './constants';
import type { IconItem } from './icons';

const IconRow = memo(function IconRow({ items, color }: { items: IconItem[]; color: string }) {
  return (
    <div className="px-2 grid grid-cols-8 gap-1">
      {items.map((item) => {
        const IconComponent = item.icon;
        return (
          <button
            key={item.name}
            data-icon={item.name}
            data-color={color}
            className="w-full aspect-square flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <IconComponent size={20} style={{ color }} />
          </button>
        );
      })}
    </div>
  );
});

interface VirtualIconGridProps {
  icons: IconItem[];
  onSelect: (iconName: string, color: string) => void;
  onPreview?: (icon: string | null) => void;
  recentIcons: string[];
  categoryName: string;
  iconColor: string;
}

export function VirtualIconGrid({
  icons,
  onSelect,
  onPreview,
  recentIcons,
  categoryName,
  iconColor,
}: VirtualIconGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const recentIconItems = useMemo(() => {
    return recentIcons
      .map(iconValue => {
        const parts = iconValue.split(':');
        const iconName = parts[1];
        const iconItem = ICON_MAP.get(iconName);
        if (!iconItem) return null;
        return { ...iconItem };
      })
      .filter((item): item is IconItem => item !== null)
      .slice(0, 16);
  }, [recentIcons]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'icons'; content: string | IconItem[] }[] = [];
    
    if (recentIconItems.length > 0) {
      result.push({ type: 'title', content: 'Recent' });
      for (let i = 0; i < recentIconItems.length; i += ICON_PER_ROW) {
        result.push({ type: 'icons', content: recentIconItems.slice(i, i + ICON_PER_ROW) });
      }
    }
    
    result.push({ type: 'title', content: categoryName });
    for (let i = 0; i < icons.length; i += ICON_PER_ROW) {
      result.push({ type: 'icons', content: icons.slice(i, i + ICON_PER_ROW) });
    }
    
    return result;
  }, [icons, recentIconItems, categoryName]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'title' ? 28 : ICON_SIZE + ROW_GAP,
    overscan: 8,
  });

  // Scroll to category title on mount or category change (skip Recent section, except for first category)
  useEffect(() => {
    // First category (Common) should show Recent section
    if (categoryName === 'Common') {
      virtualizer.scrollToIndex(0, { align: 'start' });
    } else if (recentIconItems.length > 0) {
      const recentRows = Math.ceil(recentIconItems.length / ICON_PER_ROW) + 1;
      virtualizer.scrollToIndex(recentRows, { align: 'start' });
    } else {
      virtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [categoryName]);

  const lastPreviewRef = useRef<string | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-icon]') as HTMLElement;
    if (button?.dataset.icon && button?.dataset.color) {
      onSelect(button.dataset.icon, button.dataset.color);
    }
  }, [onSelect]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-icon]') as HTMLElement;
    const iconValue = button?.dataset.icon && button?.dataset.color 
      ? `icon:${button.dataset.icon}:${button.dataset.color}` 
      : null;
    if (iconValue !== lastPreviewRef.current) {
      lastPreviewRef.current = iconValue;
      onPreview?.(iconValue);
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
                <IconRow items={row.content as IconItem[]} color={iconColor} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Search results component
interface VirtualIconSearchResultsProps {
  results: IconItem[];
  iconColor: string;
  onSelect: (iconName: string, color: string) => void;
  onPreview?: (icon: string | null) => void;
}

export function VirtualIconSearchResults({
  results,
  iconColor,
  onSelect,
  onPreview,
}: VirtualIconSearchResultsProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const lastPreviewRef = useRef<string | null>(null);

  const rows = useMemo(() => {
    const result: IconItem[][] = [];
    for (let i = 0; i < results.length; i += ICON_PER_ROW) {
      result.push(results.slice(i, i + ICON_PER_ROW));
    }
    return result;
  }, [results]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ICON_SIZE + ROW_GAP,
    overscan: 8,
  });

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-icon]') as HTMLElement;
    if (button?.dataset.icon && button?.dataset.color) {
      onSelect(button.dataset.icon, button.dataset.color);
    }
  }, [onSelect]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-icon]') as HTMLElement;
    const iconValue = button?.dataset.icon && button?.dataset.color 
      ? `icon:${button.dataset.icon}:${button.dataset.color}` 
      : null;
    if (iconValue !== lastPreviewRef.current) {
      lastPreviewRef.current = iconValue;
      onPreview?.(iconValue);
    }
  }, [onPreview]);

  const handleMouseLeave = useCallback(() => {
    lastPreviewRef.current = null;
    onPreview?.(null);
  }, [onPreview]);

  if (results.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
        No icons found
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
        {virtualizer.getVirtualItems().map((virtualRow) => (
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
            <IconRow items={rows[virtualRow.index]} color={iconColor} />
          </div>
        ))}
      </div>
    </div>
  );
}
