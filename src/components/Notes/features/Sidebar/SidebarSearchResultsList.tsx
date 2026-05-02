import { useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NotesSidebarRow } from './NotesSidebarRow';
import type { NotesSidebarSearchResult } from './notesSidebarSearchResults';
import {
  buildNotesSidebarSearchLayoutItems,
  estimateNotesSidebarSearchRowHeight,
} from './sidebarSearchResultLayout';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';

interface SidebarSearchResultsListProps {
  results: NotesSidebarSearchResult[];
  query: string;
  currentNotePath?: string | null;
  onOpen: (result: NotesSidebarSearchResult) => void;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  isContentScanPending: boolean;
}

function HighlightedSearchText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return <span className={className}>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), highlighted: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), highlighted: false });
    }

    parts.push({
      text: text.slice(matchIndex, matchIndex + trimmedQuery.length),
      highlighted: true,
    });
    cursor = matchIndex + trimmedQuery.length;
  }

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.highlighted ? 'text-blue-500' : undefined}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}

function SidebarSearchResultRow({
  result,
  query,
  currentNotePath,
  onOpen,
  showFileHeader,
}: {
  result: NotesSidebarSearchResult;
  query: string;
  currentNotePath?: string | null;
  onOpen: (result: NotesSidebarSearchResult) => void;
  showFileHeader: boolean;
}) {
  const { path, name, preview, contentSnippet } = result;
  const noteIcon = useDisplayIcon(path);
  const locationLabel = preview.replace(/\/$/, '');
  const hasLocationLine = Boolean(locationLabel);
  const hasContentLine = Boolean(contentSnippet);
  const rowClassName = hasContentLine
    ? 'h-auto min-h-[58px] items-start py-2'
    : hasLocationLine
      ? 'h-auto min-h-[40px] items-start py-1.5'
      : undefined;
  const leadingClassName =
    showFileHeader && (hasLocationLine || hasContentLine) ? 'self-start pt-0.5' : undefined;
  const contentClassName =
    showFileHeader && (hasLocationLine || hasContentLine) ? 'pt-0.5' : undefined;

  return (
    <NotesSidebarRow
      leading={showFileHeader ? (
        noteIcon ? (
          <NoteIcon icon={noteIcon} size={NOTES_SIDEBAR_ICON_SIZE} />
        ) : (
          <Icon
            name="file.text"
            size={NOTES_SIDEBAR_ICON_SIZE}
            className="text-[var(--notes-sidebar-file-icon)]"
          />
        )
      ) : (
        <span aria-hidden="true" className="block size-[20px]" />
      )}
      leadingClassName={leadingClassName}
      rowClassName={rowClassName}
      contentClassName={contentClassName}
      isActive={path === currentNotePath}
      onClick={() => onOpen(result)}
      main={(
        <div className={cn('min-w-0', hasContentLine && 'space-y-0.5')}>
          {showFileHeader ? (
            <div className="truncate text-[16px] leading-5 text-[var(--notes-sidebar-text)]">
              <HighlightedSearchText
                text={name}
                query={query}
                className={cn(path === currentNotePath && 'font-medium')}
              />
            </div>
          ) : null}
          {locationLabel ? (
            <div className="truncate text-[16px] leading-4 text-[var(--notes-sidebar-text-soft)]">
              <HighlightedSearchText text={locationLabel} query={query} />
            </div>
          ) : null}
          {contentSnippet ? (
            <div className="whitespace-normal break-words text-[16px] leading-4 text-[var(--notes-sidebar-text-soft)]">
              <HighlightedSearchText text={contentSnippet} query={query} />
            </div>
          ) : null}
        </div>
      )}
    />
  );
}

export function SidebarSearchResultsList({
  results,
  query,
  currentNotePath,
  onOpen,
  scrollRootRef,
  isContentScanPending,
}: SidebarSearchResultsListProps) {
  const deferredQuery = useDeferredValue(query);
  const [containerWidth, setContainerWidth] = useState(280);
  const previousQueryRef = useRef<string>('');
  const items = useMemo(
    () => buildNotesSidebarSearchLayoutItems(results),
    [results],
  );
  const estimates = useMemo(
    () => items.map((item) => estimateNotesSidebarSearchRowHeight(item, containerWidth)),
    [containerWidth, items],
  );
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRootRef.current,
    estimateSize: (index) => estimates[index] ?? 40,
    overscan: 6,
  });

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) {
      return;
    }

    const commitWidth = () => {
      const nextWidth = scrollRoot.clientWidth;
      setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    commitWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      commitWidth();
    });
    resizeObserver.observe(scrollRoot);

    return () => {
      resizeObserver.disconnect();
    };
  }, [scrollRootRef]);

  useEffect(() => {
    const trimmedQuery = deferredQuery.trim();
    if (previousQueryRef.current === trimmedQuery) {
      return;
    }

    previousQueryRef.current = trimmedQuery;
    scrollRootRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [deferredQuery, scrollRootRef]);

  useEffect(() => {
    virtualizer.measure();
  }, [containerWidth, estimates, virtualizer]);

  const hasQuery = deferredQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      {isContentScanPending ? (
        <div className="px-3 py-1 text-[16px] text-[var(--notes-sidebar-text-soft)]">
          Searching note contents...
        </div>
      ) : null}
      {items.length > 0 ? (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) {
              return null;
            }

            return (
              <div
                key={item.result.id}
                style={{
                  height: `${virtualRow.size}px`,
                  left: 0,
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                }}
              >
                <SidebarSearchResultRow
                  result={item.result}
                  query={deferredQuery}
                  currentNotePath={currentNotePath}
                  onOpen={onOpen}
                  showFileHeader={item.showFileHeader}
                />
              </div>
            );
          })}
        </div>
      ) : hasQuery && !isContentScanPending ? (
        <div className="px-3 py-2 text-[16px] text-[var(--notes-sidebar-text-soft)]">
          No results
        </div>
      ) : null}
    </div>
  );
}
