import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  SidebarSearchDrawer,
  useSidebarSearchDrawerState,
} from '@/components/layout/sidebar/SidebarSearchDrawer';
import type { SidebarSearchState } from '@/components/layout/sidebar/useSidebarSearchState';
import { cn } from '@/lib/utils';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { NoteIcon } from '../IconPicker/NoteIcon';
import { StarredSection } from '../Starred';
import { triggerHoveredSidebarRename } from '../common/sidebarHoverRename';
import { NotesSidebarRow } from './NotesSidebarRow';
import { NotesSidebarScrollArea } from './NotesSidebarPrimitives';
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { RootFolderRow } from './RootFolderRow';
import {
  buildNotesSidebarSearchIndex,
  countNotesSidebarSearchEntries,
  type NotesSidebarSearchResult,
  queryNotesSidebarSearch,
  shouldSearchNotesSidebarContents,
} from './notesSidebarSearchResults';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';
import {
  applySidebarSearchNavigation,
  clearSidebarSearchHighlights,
  clearSidebarSearchNavigationPending,
  markSidebarSearchNavigationPending,
} from './sidebarSearchNavigation';
import { getCurrentEditorView } from '../Editor/utils/editorViewRegistry';
import {
  getSidebarSearchDebugViewMeta,
  logSidebarSearchDebug,
} from './sidebarSearchDebug';

interface SidebarContentProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string | null;
  createNote: () => Promise<unknown>;
  createFolder: (path: string) => Promise<string | null>;
  search: SidebarSearchState;
  className?: string;
  isPeeking?: boolean;
}

interface SidebarSearchResultRowProps {
  result: NotesSidebarSearchResult;
  query: string;
  currentNotePath?: string | null;
  onOpen: (result: NotesSidebarSearchResult) => void;
  showFileHeader: boolean;
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
}: SidebarSearchResultRowProps) {
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
            <div className="truncate text-[13px] leading-5 text-[var(--notes-sidebar-text)]">
              <HighlightedSearchText
                text={name}
                query={query}
                className={cn(path === currentNotePath && 'font-medium')}
              />
            </div>
          ) : null}
          {locationLabel ? (
            <div className="truncate text-[10px] leading-4 text-[var(--notes-sidebar-text-soft)]">
              <HighlightedSearchText text={locationLabel} query={query} />
            </div>
          ) : null}
          {contentSnippet ? (
            <div className="whitespace-normal break-words text-[11px] leading-4 text-[var(--notes-sidebar-text-soft)]">
              <HighlightedSearchText text={contentSnippet} query={query} />
            </div>
          ) : null}
        </div>
      )}
    />
  );
}

export function SidebarContent({
  rootFolder,
  isLoading,
  currentNotePath,
  createNote,
  createFolder,
  search,
  className,
  isPeeking = false,
}: SidebarContentProps) {
  const openNote = useNotesStore((s) => s.openNote);
  const getDisplayName = useNotesStore((s) => s.getDisplayName);
  const noteContentsCache = useNotesStore((s) => s.noteContentsCache);
  const scanAllNotes = useNotesStore((s) => s.scanAllNotes);
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const contentScanPromiseRef = useRef<Promise<void> | null>(null);
  const [isContentScanPending, setIsContentScanPending] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    path: string;
    query: string;
    contentMatchOrdinal: number | null;
    previousView: ReturnType<typeof getCurrentEditorView>;
  } | null>(null);
  const deferredSearchQuery = useDeferredValue(search.searchQuery);
  const {
    inputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
    shouldShowSearchResults,
  } = useSidebarSearchDrawerState({
    isOpen: search.isSearchOpen,
    query: search.searchQuery,
    onOpen: search.openSearch,
    onClose: search.closeSearch,
    scopeRef: sidebarRootRef,
  });

  const searchIndex = useMemo(
    () => buildNotesSidebarSearchIndex(rootFolder, getDisplayName),
    [getDisplayName, rootFolder],
  );
  const searchableNoteCount = useMemo(
    () => countNotesSidebarSearchEntries(rootFolder),
    [rootFolder],
  );
  const shouldSearchContents = shouldSearchNotesSidebarContents(deferredSearchQuery);
  const isContentIndexReady =
    searchableNoteCount > 0 && noteContentsCache.size >= searchableNoteCount;

  const searchResults = useMemo(
    () =>
      queryNotesSidebarSearch(
        searchIndex,
        deferredSearchQuery,
        (path) => noteContentsCache.get(path)?.content,
      ),
    [deferredSearchQuery, noteContentsCache, searchIndex],
  );

  useEffect(() => {
    const isMac =
      typeof window !== 'undefined' &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (target.isContentEditable) {
        return true;
      }

      const editable = target.closest('input, textarea, select, [contenteditable="true"]');
      return editable instanceof HTMLElement;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      const isF2 = event.key === 'F2';
      const isMacEnter = isMac && event.key === 'Enter';

      if (!isF2 && !isMacEnter) {
        return;
      }

      if (isEditableTarget(event.target) && !isF2) {
        return;
      }

      if (!triggerHoveredSidebarRename()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (search.isSearchOpen) {
      return;
    }

    clearSidebarSearchHighlights();
    setPendingNavigation(null);
  }, [search.isSearchOpen]);

  useEffect(() => {
    if (
      !search.isSearchOpen ||
      !shouldSearchContents ||
      searchableNoteCount === 0 ||
      isContentIndexReady
    ) {
      setIsContentScanPending(false);
      return;
    }

    if (contentScanPromiseRef.current) {
      setIsContentScanPending(true);
      return;
    }

    let cancelled = false;
    setIsContentScanPending(true);

    const promise = scanAllNotes()
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('[SidebarContent] scanAllNotes failed:', error);
        }
      })
      .finally(() => {
        if (contentScanPromiseRef.current === promise) {
          contentScanPromiseRef.current = null;
        }

        if (!cancelled) {
          setIsContentScanPending(false);
        }
      });

    contentScanPromiseRef.current = promise;

    return () => {
      cancelled = true;
    };
  }, [
    isContentIndexReady,
    scanAllNotes,
    search.isSearchOpen,
    searchableNoteCount,
    shouldSearchContents,
  ]);

  useEffect(() => {
    if (!pendingNavigation || currentNotePath !== pendingNavigation.path) {
      if (pendingNavigation) {
        logSidebarSearchDebug('sidebar:pending-navigation:waiting', {
          currentNotePath: currentNotePath ?? null,
          pendingPath: pendingNavigation.path,
          query: pendingNavigation.query,
          contentMatchOrdinal: pendingNavigation.contentMatchOrdinal,
          previousView: getSidebarSearchDebugViewMeta(pendingNavigation.previousView),
          currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
        });
      }
      return;
    }

    let cancelled = false;
    logSidebarSearchDebug('sidebar:pending-navigation:apply:start', {
      currentNotePath,
      pendingPath: pendingNavigation.path,
      query: pendingNavigation.query,
      contentMatchOrdinal: pendingNavigation.contentMatchOrdinal,
      previousView: getSidebarSearchDebugViewMeta(pendingNavigation.previousView),
      currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
    });

    void applySidebarSearchNavigation({
      path: pendingNavigation.path,
      query: pendingNavigation.query,
      contentMatchOrdinal: pendingNavigation.contentMatchOrdinal,
      previousView: pendingNavigation.previousView,
    })
      .then((success) => {
        logSidebarSearchDebug('sidebar:pending-navigation:apply:resolved', {
          currentNotePath,
          pendingPath: pendingNavigation.path,
          success,
          currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
        });
      })
      .finally(() => {
        logSidebarSearchDebug('sidebar:pending-navigation:apply:finally', {
          currentNotePath,
          pendingPath: pendingNavigation.path,
          cancelled,
        });
        if (!cancelled) {
          setPendingNavigation((current) =>
            current === pendingNavigation ? null : current,
          );
        }
      });

    return () => {
      cancelled = true;
      logSidebarSearchDebug('sidebar:pending-navigation:apply:cleanup', {
        currentNotePath: currentNotePath ?? null,
        pendingPath: pendingNavigation.path,
      });
    };
  }, [currentNotePath, pendingNavigation]);

  const handleOpenSearchResult = (result: NotesSidebarSearchResult) => {
    const previousView = currentNotePath === result.path ? null : getCurrentEditorView();
    const nextNavigation = {
      path: result.path,
      query: deferredSearchQuery,
      contentMatchOrdinal: result.contentMatchOrdinal,
      previousView,
    };

    logSidebarSearchDebug('sidebar:result:click', {
      resultId: result.id,
      currentNotePath: currentNotePath ?? null,
      targetPath: result.path,
      query: deferredSearchQuery,
      contentMatchOrdinal: result.contentMatchOrdinal,
      previousView: getSidebarSearchDebugViewMeta(previousView),
    });
    markSidebarSearchNavigationPending(result.path);
    setPendingNavigation(nextNavigation);
    logSidebarSearchDebug('sidebar:pending-navigation:set', {
      currentNotePath: currentNotePath ?? null,
      targetPath: result.path,
      query: deferredSearchQuery,
      contentMatchOrdinal: result.contentMatchOrdinal,
      previousView: getSidebarSearchDebugViewMeta(previousView),
    });

    if (currentNotePath === result.path) {
      logSidebarSearchDebug('sidebar:result:click:same-note', {
        path: result.path,
      });
      return;
    }

    logSidebarSearchDebug('sidebar:open-note:start', {
      fromPath: currentNotePath ?? null,
      targetPath: result.path,
    });
    void openNote(result.path)
      .then(() => {
        logSidebarSearchDebug('sidebar:open-note:resolved', {
          targetPath: result.path,
          currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
          currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
        });
      })
      .catch((error) => {
        logSidebarSearchDebug('sidebar:open-note:rejected', {
          targetPath: result.path,
          message: error instanceof Error ? error.message : String(error),
        });
        clearSidebarSearchNavigationPending(result.path);
        setPendingNavigation((current) =>
          current === nextNavigation ? null : current,
        );
      });
  };

  return (
    <div ref={sidebarRootRef} className={cn('flex h-full flex-col', className)}>
      <SidebarSearchDrawer
        isSearchOpen={search.isSearchOpen}
        shouldShowTopActions={!shouldShowSearchResults}
        searchQuery={search.searchQuery}
        setSearchQuery={search.setSearchQuery}
        inputRef={inputRef}
        hideSearch={hideSearch}
        canSubmit={Boolean(searchResults[0])}
        onSubmit={() => {
          const result = searchResults[0];
          if (!result) {
            return;
          }
          handleOpenSearchResult(result);
        }}
        placeholder="Search"
        closeLabel="Close sidebar search"
        topActions={<NotesSidebarTopActions />}
      />

      <NotesSidebarScrollArea
        ref={scrollRootRef}
        className={cn(isPeeking ? 'vlaina-scrollbar-rounded pt-4 pb-4' : 'pt-2')}
        data-notes-sidebar-scroll-root="true"
        onScroll={handleScroll}
      >
        {shouldShowSearchResults ? (
          searchResults.length > 0 || isContentScanPending ? (
            <div className="flex flex-col gap-0.5">
              {isContentScanPending ? (
                <div className="px-3 py-1 text-[11px] text-[var(--notes-sidebar-text-soft)]">
                  Searching note contents...
                </div>
              ) : null}
              {searchResults.map((result, index) => (
                <SidebarSearchResultRow
                  key={result.id}
                  result={result}
                  query={deferredSearchQuery}
                  currentNotePath={currentNotePath}
                  onOpen={handleOpenSearchResult}
                  showFileHeader={index === 0 || searchResults[index - 1]?.path !== result.path}
                />
              ))}
            </div>
          ) : null
        ) : (
          <div className="space-y-1">
            <StarredSection showTitle={false} />
            <RootFolderRow
              rootFolder={rootFolder}
              isLoading={isLoading}
              currentNotePath={currentNotePath}
              onCreateNote={createNote}
              onCreateFolder={() => createFolder('')}
            />
          </div>
        )}
      </NotesSidebarScrollArea>
    </div>
  );
}
