/**
 * VirtualIconGrid - Virtualized icon grid with recent section
 */

import { useRef, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ICON_PER_ROW, ICON_SIZE, ROW_GAP, ICON_MAP, SCROLLBAR_CLASSNAME } from './constants';
import type { IconItem } from './icons';

interface IconRowProps {
  items: IconItem[];
  color: string;
  keyPrefix?: string;
}

const IconRow = memo(
  function IconRow({ items, color, keyPrefix = '' }: IconRowProps) {
    return (
      <div className="px-2 grid grid-cols-8 gap-1">
        {items.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={keyPrefix + item.name}
              data-icon={item.name}
              data-color={color}
              className="w-full aspect-square flex items-center justify-center rounded-md hover:bg-[var(--neko-bg-hover)]"
            >
              <IconComponent size={20} style={{ color }} />
            </button>
          );
        })}
      </div>
    );
  },
  (prev, next) => {
    // Only re-render when items reference or color actually changes
    if (prev.color !== next.color) return false;
    if (prev.keyPrefix !== next.keyPrefix) return false;
    if (prev.items.length !== next.items.length) return false;
    // Compare items by name (since items is a new array from slice)
    for (let i = 0; i < prev.items.length; i++) {
      if (prev.items[i].name !== next.items[i].name) return false;
    }
    return true;
  }
);

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

  // Use ref to store callbacks to avoid re-renders from dependency changes
  const onPreviewRef = useRef(onPreview);
  const onSelectRef = useRef(onSelect);
  onPreviewRef.current = onPreview;
  onSelectRef.current = onSelect;

  const recentIconItems = useMemo(() => {
    const seen = new Set<string>();
    return recentIcons
      .map(iconValue => {
        const parts = iconValue.split(':');
        const iconName = parts[1];
        if (seen.has(iconName)) return null;
        seen.add(iconName);
        const iconItem = ICON_MAP.get(iconName);
        if (!iconItem) return null;
        return { ...iconItem };
      })
      .filter((item): item is IconItem => item !== null)
      .slice(0, 16);
  }, [recentIcons]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'icons'; content: string | IconItem[]; isRecent?: boolean }[] = [];

    if (recentIconItems.length > 0) {
      result.push({ type: 'title', content: 'Recent' });
      for (let i = 0; i < recentIconItems.length; i += ICON_PER_ROW) {
        result.push({ type: 'icons', content: recentIconItems.slice(i, i + ICON_PER_ROW), isRecent: true });
      }
    }

    result.push({ type: 'title', content: categoryName });
    for (let i = 0; i < icons.length; i += ICON_PER_ROW) {
      result.push({ type: 'icons', content: icons.slice(i, i + ICON_PER_ROW) });
    }

    return result;
  }, [icons, recentIconItems, categoryName]);

  const rowSizeGetter = useMemo(() => {
    return (index: number) => rows[index].type === 'title' ? 28 : ICON_SIZE + ROW_GAP;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: rowSizeGetter,
    overscan: 5,
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

  // Use native event handling to bypass React's synthetic event system for better performance
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      if (button?.dataset.icon && button?.dataset.color) {
        const iconValue = `icon:${button.dataset.icon}:${button.dataset.color}`;
        if (iconValue !== lastPreviewRef.current) {
          lastPreviewRef.current = iconValue;
          onPreviewRef.current?.(iconValue);
        }
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
      const button = target.closest('[data-icon]') as HTMLElement;
      if (button?.dataset.icon && button?.dataset.color) {
        onSelectRef.current(button.dataset.icon, button.dataset.color);
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
                <div className="px-2 pt-2 pb-1 text-xs text-[var(--neko-text-tertiary)] font-medium">
                  {row.content as string}
                </div>
              ) : (
                <IconRow items={row.content as IconItem[]} color={iconColor} keyPrefix={row.isRecent ? 'recent-' : ''} />
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

  // Use ref to store callbacks
  const onPreviewRef = useRef(onPreview);
  const onSelectRef = useRef(onSelect);
  onPreviewRef.current = onPreview;
  onSelectRef.current = onSelect;

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
    overscan: 5,
  });

  // Use native event handling
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      if (button?.dataset.icon && button?.dataset.color) {
        const iconValue = `icon:${button.dataset.icon}:${button.dataset.color}`;
        if (iconValue !== lastPreviewRef.current) {
          lastPreviewRef.current = iconValue;
          onPreviewRef.current?.(iconValue);
        }
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
      const button = target.closest('[data-icon]') as HTMLElement;
      if (button?.dataset.icon && button?.dataset.color) {
        onSelectRef.current(button.dataset.icon, button.dataset.color);
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
      <div className="h-[280px] flex items-center justify-center text-sm text-[var(--neko-text-tertiary)]">
        No icons found
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