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
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { RootFolderRow } from './RootFolderRow';
import { SidebarSearchResultsList } from './SidebarSearchResultsList';
import {
  buildNotesSidebarSearchIndex,
  countNotesSidebarSearchEntries,
  type NotesSidebarSearchResult,
  queryNotesSidebarSearch,
  shouldSearchNotesSidebarContents,
} from './notesSidebarSearchResults';
import {
  applySidebarSearchNavigation,
  clearSidebarSearchHighlights,
  clearSidebarSearchNavigationPending,
  markSidebarSearchNavigationPending,
} from './sidebarSearchNavigation';
import { getCurrentEditorView } from '../Editor/utils/editorViewRegistry';

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
  const openNote = useNotesStore((s) => s.openNote);
  const getDisplayName = useNotesStore((s) => s.getDisplayName);
  const noteContentsCache = useNotesStore((s) => s.noteContentsCache);
  const scanAllNotes = useNotesStore((s) => s.scanAllNotes);
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const contentScanPromiseRef = useRef<Promise<void> | null>(null);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
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
  const shouldShowEmptyHint =
    !isLoading &&
    (!rootFolder || rootFolder.children.length === 0);

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
    if (search.isSearchOpen && search.searchQuery.trim().length > 0) {
      return;
    }

    clearSidebarSearchHighlights();
    clearSidebarSearchNavigationPending();
    setPendingNavigation(null);
  }, [search.isSearchOpen, search.searchQuery]);

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
      return;
    }

    let cancelled = false;

    void applySidebarSearchNavigation({
      path: pendingNavigation.path,
      query: pendingNavigation.query,
      contentMatchOrdinal: pendingNavigation.contentMatchOrdinal,
      previousView: pendingNavigation.previousView,
    }).finally(() => {
      if (!cancelled) {
        setPendingNavigation((current) =>
          current === pendingNavigation ? null : current,
        );
      }
    });

    return () => {
      cancelled = true;
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

    markSidebarSearchNavigationPending(result.path);
    setPendingNavigation(nextNavigation);

    if (currentNotePath === result.path) {
      return;
    }

    void openNote(result.path).catch(() => {
      clearSidebarSearchNavigationPending(result.path);
      setPendingNavigation((current) =>
        current === nextNavigation ? null : current,
      );
    });
  };

  const handleOpenMarkdownFile = () => {
    window.dispatchEvent(new Event('vlaina-open-markdown-file'));
  };

  return (
    <div
      ref={sidebarRootRef}
      className={cn('group/sidebar-content relative flex h-full flex-col', className)}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
    >
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
      </NotesSidebarScrollArea>
      {!shouldShowSearchResults && shouldShowEmptyHint ? (
        <NotesSidebarHoverEmptyHint
          title="No notes yet"
          actionLabel="Open"
          onAction={handleOpenMarkdownFile}
          visible={isSidebarHovered}
        />
      ) : null}
    </div>
  );
}
