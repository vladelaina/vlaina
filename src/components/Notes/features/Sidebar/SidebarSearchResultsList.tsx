import { useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { NotesSidebarRow } from './NotesSidebarRow';
import { useI18n } from '@/lib/i18n';
import type { NotesSidebarSearchResult } from './notesSidebarSearchResults';
import {
  buildNotesSidebarSearchLayoutItems,
  estimateNotesSidebarSearchRowHeight,
} from './sidebarSearchResultLayout';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';
import { themeDomStyleTokens, themeImageBlockStyleTokens } from '@/styles/themeTokens';

interface SidebarSearchResultsListProps {
  results: NotesSidebarSearchResult[];
  query: string;
  currentNotePath?: string | null;
  activeResultId?: string | null;
  highlightedResultId?: string | null;
  onOpen: (result: NotesSidebarSearchResult) => void;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  isContentScanPending: boolean;
}

function normalizeSearchTextWithOffsets(value: string): {
  text: string;
  startOffsets: number[];
  endOffsets: number[];
} {
  let text = '';
  const startOffsets: number[] = [];
  const endOffsets: number[] = [0];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    const source = codePoint === undefined ? value[index] : String.fromCodePoint(codePoint);
    const sourceLength = source.length;
    const sourceEnd = index + sourceLength;
    const normalized = source.toLocaleLowerCase();
    const normalizedStart = text.length;

    for (let offset = 0; offset < normalized.length; offset += 1) {
      startOffsets[normalizedStart + offset] = index;
      endOffsets[normalizedStart + offset + 1] = sourceEnd;
    }

    text += normalized;
    index = sourceEnd;
  }

  startOffsets[text.length] = value.length;
  endOffsets[text.length] = value.length;

  return { text, startOffsets, endOffsets };
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

  const normalizedText = normalizeSearchTextWithOffsets(text);
  const lowerText = normalizedText.text;
  const lowerQuery = trimmedQuery.toLocaleLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  let normalizedCursor = 0;

  while (normalizedCursor < lowerText.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, normalizedCursor);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), highlighted: false });
      break;
    }

    const sourceStart = normalizedText.startOffsets[matchIndex] ?? cursor;
    const sourceEnd = normalizedText.endOffsets[matchIndex + lowerQuery.length] ?? text.length;

    if (sourceStart > cursor) {
      parts.push({ text: text.slice(cursor, sourceStart), highlighted: false });
    }

    parts.push({
      text: text.slice(sourceStart, sourceEnd),
      highlighted: true,
    });
    cursor = sourceEnd;
    normalizedCursor = matchIndex + Math.max(lowerQuery.length, 1);
  }

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.highlighted ? 'text-[var(--vlaina-color-status-info-fg)]' : undefined}
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
  isActive,
  isHighlighted,
  onOpen,
  showFileHeader,
}: {
  result: NotesSidebarSearchResult;
  query: string;
  currentNotePath?: string | null;
  isActive: boolean;
  isHighlighted: boolean;
  onOpen: (result: NotesSidebarSearchResult) => void;
  showFileHeader: boolean;
}) {
  const { path, name, preview, contentSnippet } = result;
  const noteIcon = useDisplayIcon(path);
  const locationLabel = preview.replace(/\/$/, '');
  const hasLocationLine = Boolean(locationLabel);
  const hasContentLine = Boolean(contentSnippet);
  const rowClassName = hasContentLine
    ? 'h-auto min-h-[var(--vlaina-size-58px)] items-start py-2'
    : hasLocationLine
      ? 'h-auto min-h-[var(--vlaina-size-40px)] items-start py-1.5'
      : undefined;
  const leadingClassName =
    showFileHeader && (hasLocationLine || hasContentLine) ? 'self-start pt-0.5' : undefined;
  const contentClassName =
    showFileHeader && (hasLocationLine || hasContentLine) ? 'pt-0.5' : undefined;

  return (
    <NotesSidebarRow
      leading={showFileHeader ? (
        noteIcon ? (
          <NoteIcon icon={noteIcon} notePath={path} size={NOTES_SIDEBAR_ICON_SIZE} />
        ) : (
          <Icon
            name="file.text"
            size={NOTES_SIDEBAR_ICON_SIZE}
            className="text-[var(--vlaina-sidebar-notes-file-icon)]"
          />
        )
      ) : (
        <span aria-hidden="true" className="block size-[var(--vlaina-size-20px)]" />
      )}
      leadingClassName={leadingClassName}
      rowClassName={rowClassName}
      contentClassName={contentClassName}
      isActive={isActive}
      isHighlighted={isHighlighted}
      aria-selected={isHighlighted || undefined}
      onClick={() => onOpen(result)}
      main={(
        <div className={cn('min-w-0', hasContentLine && 'space-y-0.5')}>
          {showFileHeader ? (
            <div className="whitespace-normal break-words text-[var(--vlaina-font-base)] leading-5 text-[var(--vlaina-sidebar-notes-text)] [overflow-wrap:anywhere]">
              <HighlightedSearchText
                text={name}
                query={query}
                className={cn(isActive && path === currentNotePath && 'font-medium')}
              />
            </div>
          ) : null}
          {locationLabel ? (
            <div className="whitespace-normal break-words text-[var(--vlaina-font-11)] leading-3 text-[var(--vlaina-sidebar-notes-text-soft)] [overflow-wrap:anywhere]">
              <HighlightedSearchText text={locationLabel} query={query} />
            </div>
          ) : null}
          {contentSnippet ? (
            <div className="whitespace-normal break-words text-[var(--vlaina-font-xs)] leading-3 text-[var(--vlaina-sidebar-notes-text-soft)]">
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
  activeResultId,
  highlightedResultId,
  onOpen,
  scrollRootRef,
  isContentScanPending,
}: SidebarSearchResultsListProps) {
  const { t } = useI18n();
  const deferredQuery = useDeferredValue(query);
  const [containerWidth, setContainerWidth] = useState(280);
  const previousQueryRef = useRef<string>('');
  const widthFrameRef = useRef<number | null>(null);
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
    const scheduleWidthCommit = () => {
      if (widthFrameRef.current !== null) {
        return;
      }

      widthFrameRef.current = requestAnimationFrame(() => {
        widthFrameRef.current = null;
        commitWidth();
      });
    };

    commitWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(scheduleWidthCommit);
    resizeObserver.observe(scrollRoot);

    return () => {
      if (widthFrameRef.current !== null) {
        cancelAnimationFrame(widthFrameRef.current);
        widthFrameRef.current = null;
      }
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

  useEffect(() => {
    if (!highlightedResultId) {
      return;
    }

    const highlightedIndex = items.findIndex((item) => item.result.id === highlightedResultId);
    if (highlightedIndex < 0) {
      return;
    }

    virtualizer.scrollToIndex(highlightedIndex, { align: 'auto' });
  }, [highlightedResultId, items, virtualizer]);

  return (
    <div className="flex flex-col gap-0.5">
      {isContentScanPending ? (
        <div className="px-3 py-1 text-[var(--vlaina-font-base)] text-[var(--vlaina-sidebar-notes-text-soft)]">
          {t('notes.searchingNoteContents')}
        </div>
      ) : null}
      {items.length > 0 ? (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: themeDomStyleTokens.positionRelative,
            width: themeImageBlockStyleTokens.widthFull,
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
                  left: themeDomStyleTokens.numericZero,
                  position: themeDomStyleTokens.positionAbsolute,
                  top: themeDomStyleTokens.numericZero,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: themeImageBlockStyleTokens.widthFull,
                }}
              >
                <SidebarSearchResultRow
                  result={item.result}
                  query={deferredQuery}
                  currentNotePath={currentNotePath}
                  isActive={item.result.id === activeResultId}
                  isHighlighted={item.result.id === highlightedResultId}
                  onOpen={onOpen}
                  showFileHeader={item.showFileHeader}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
