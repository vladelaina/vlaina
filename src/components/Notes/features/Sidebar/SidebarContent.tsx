import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  SidebarSearchDrawer,
  useSidebarSearchDrawerState,
} from '@/components/layout/sidebar/SidebarSearchDrawer';
import type { SidebarSearchState } from '@/components/layout/sidebar/useSidebarSearchState';
import { cn } from '@/lib/utils';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { StarredSection } from '../Starred';
import { triggerHoveredSidebarRename } from '../common/sidebarHoverRename';
import {
  NotesSidebarHoverEmptyHint,
  NotesSidebarScrollArea,
} from './NotesSidebarPrimitives';
import { SidebarSearchResultsList } from './SidebarSearchResultsList';
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { RootFolderRow } from './RootFolderRow';
import {
  buildNotesSidebarSearchIndex,
  type NotesSidebarSearchResult,
  queryNotesSidebarSearch,
  shouldSearchNotesSidebarContents,
} from './notesSidebarSearchResults';
import {
  applySidebarSearchNavigation,
  clearSidebarSearchHighlights,
  clearSidebarSearchNavigationPending,
  isSidebarSearchNavigationPending,
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
  const openNote = useNotesStore((state) => state.openNote);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);
  const noteContentsCache = useNotesStore((state) => state.noteContentsCache);
  const scanAllNotes = useNotesStore((state) => state.scanAllNotes);
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
  const isWorkspaceEmpty = !isLoading && (!rootFolder || rootFolder.children.length === 0);
  const searchableNoteCount = searchIndex.length;
  const shouldSearchContents = shouldSearchNotesSidebarContents(deferredSearchQuery);
  const uncachedSearchableNoteCount = useMemo(
    () =>
      searchIndex.reduce(
        (count, entry) => (noteContentsCache.has(entry.path) ? count : count + 1),
        0,
      ),
    [noteContentsCache, searchIndex],
  );
  const isContentIndexReady =
    searchableNoteCount > 0 && uncachedSearchableNoteCount === 0;

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
      shouldContinue: () =>
        !cancelled &&
        useNotesStore.getState().currentNote?.path === pendingNavigation.path &&
        isSidebarSearchNavigationPending(pendingNavigation.path),
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
        <div className="relative min-h-full">
          {shouldShowSearchResults ? (
            <SidebarSearchResultsList
              results={searchResults}
              query={deferredSearchQuery}
              currentNotePath={currentNotePath}
              onOpen={handleOpenSearchResult}
              scrollRootRef={scrollRootRef}
              isContentScanPending={isContentScanPending}
            />
          ) : (
            <div className="space-y-1">
              <StarredSection showTitle={false} />
              <RootFolderRow
                rootFolder={rootFolder}
                isLoading={isLoading}
                onCreateNote={createNote}
                onCreateFolder={() => createFolder('')}
              />
            </div>
          )}
          {!shouldShowSearchResults && isWorkspaceEmpty ? (
            <NotesSidebarHoverEmptyHint title="No folder opened" />
          ) : null}
        </div>
      </NotesSidebarScrollArea>
    </div>
  );
}
