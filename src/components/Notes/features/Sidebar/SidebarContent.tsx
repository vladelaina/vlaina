import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SidebarSearchDrawer, useSidebarSearchDrawerState } from '@/components/layout/sidebar/SidebarSearchDrawer';
import {
  SidebarCapsulePanel,
  SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT,
} from '@/components/layout/sidebar/SidebarPrimitives';
import type { SidebarSearchState } from '@/components/layout/sidebar/useSidebarSearchState';
import { cn } from '@/lib/utils';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { isDraftNoteEmpty, isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import { StarredSection } from '../Starred';
import { triggerHoveredSidebarRename } from '../common/sidebarHoverRename';
import { NotesSidebarHoverEmptyHint, NotesSidebarScrollArea } from './NotesSidebarPrimitives';
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { RootFolderRow } from './RootFolderRow';
import { SidebarSearchResultsList } from './SidebarSearchResultsList';
import { type NotesSidebarSearchResult } from './notesSidebarSearchResults';
import {
  applySidebarSearchNavigation,
  clearSidebarSearchHighlights,
  clearSidebarSearchNavigationPending,
  markSidebarSearchNavigationPending,
} from './sidebarSearchNavigation';
import { getCurrentEditorView } from '../Editor/utils/editorViewRegistry';
import { scheduleSidebarItemIntoView } from '../common/sidebarScrollIntoView';
import { useSidebarContentSearchResults } from './useSidebarContentSearchResults';

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
  const openNoteByAbsolutePath = useNotesStore((s) => s.openNoteByAbsolutePath);
  const draftNotes = useNotesStore((s) => s.draftNotes);
  const revealFolder = useNotesStore((s) => s.revealFolder);
  const getDisplayName = useNotesStore((s) => s.getDisplayName);
  const noteContentsCache = useNotesStore((s) => s.noteContentsCache);
  const notesPath = useNotesStore((s) => s.notesPath);
  const scanAllNotes = useNotesStore((s) => s.scanAllNotes);
  const pruneNoteContentsCacheToOpenNotes = useNotesStore((s) => s.pruneNoteContentsCacheToOpenNotes);
  const starredEntries = useNotesStore((s) => s.starredEntries);
  const currentVault = useVaultStore((s) => s.currentVault);
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const rootBlankAreaRef = useRef<HTMLDivElement | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{
    path: string;
    query: string;
    contentMatchOrdinal: number | null;
    previousView: ReturnType<typeof getCurrentEditorView>;
  } | null>(null);
  const [activeSearchResultId, setActiveSearchResultId] = useState<string | null>(null);
  const previousSearchQueryRef = useRef(search.searchQuery);
  const deferredSearchQuery = useDeferredValue(search.searchQuery);
  const displayRootFolder = useMemo(() => {
    if (!currentNotePath || !isDraftNotePath(currentNotePath)) {
      return rootFolder;
    }

    const draftEntry = draftNotes[currentNotePath];
    if (!draftEntry) {
      return rootFolder;
    }

    const draftContent = noteContentsCache.get(currentNotePath)?.content ?? '';
    if (
      rootFolder &&
      rootFolder.children.length === 0 &&
      !draftEntry.name.trim() &&
      isDraftNoteEmpty(draftContent)
    ) {
      return rootFolder;
    }

    const draftNode = {
      id: currentNotePath,
      name: resolveDraftNoteTitle(draftEntry.name),
      path: currentNotePath,
      isFolder: false as const,
    };
    const draftParentPath = draftEntry.parentPath ?? '';

    if (!rootFolder) {
      return rootFolder;
    }

    if (rootFolder.children.some((node) => node.path === currentNotePath)) {
      return rootFolder;
    }

    if (draftParentPath !== '') {
      let didInsert = false;
      const injectDraftIntoFolder = (folder: FolderNode): FolderNode => {
        if (folder.path === draftParentPath) {
          didInsert = true;
          return {
            ...folder,
            expanded: true,
            children: folder.children.some((node) => node.path === currentNotePath)
              ? folder.children
              : [draftNode, ...folder.children],
          };
        }

        const nextChildren = folder.children.map((node) => {
          if (!node.isFolder) {
            return node;
          }

          return injectDraftIntoFolder(node);
        });

        return didInsert ? { ...folder, children: nextChildren } : folder;
      };

      const nextRootFolder = injectDraftIntoFolder(rootFolder);
      return didInsert ? nextRootFolder : rootFolder;
    }

    return {
      ...rootFolder,
      children: [draftNode, ...rootFolder.children],
    };
  }, [currentNotePath, draftNotes, noteContentsCache, rootFolder]);
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
  const wasShowingSearchResultsRef = useRef(shouldShowSearchResults);
  const hasVaultPendingRoot = Boolean(currentVault && notesPath === currentVault.path && !displayRootFolder);
  const hasFileTreeEntries = Boolean(displayRootFolder && displayRootFolder.children.length > 0);
  const shouldShowEmptyHint = !isLoading && !hasVaultPendingRoot && !hasFileTreeEntries;
  const { isContentScanPending, searchResults } = useSidebarContentSearchResults({
    rootFolder: displayRootFolder,
    getDisplayName,
    noteContentsCache,
    scanAllNotes,
    pruneNoteContentsCacheToOpenNotes,
    searchQuery: deferredSearchQuery,
    isSearchOpen: search.isSearchOpen,
    starredEntries,
    currentVaultPath: currentVault?.path ?? notesPath,
  });

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
    const wasShowingSearchResults = wasShowingSearchResultsRef.current;
    wasShowingSearchResultsRef.current = shouldShowSearchResults;

    if (
      !wasShowingSearchResults ||
      shouldShowSearchResults ||
      !currentNotePath ||
      isDraftNotePath(currentNotePath) ||
      isAbsolutePath(currentNotePath)
    ) {
      return;
    }

    revealFolder(currentNotePath);
    scheduleSidebarItemIntoView(currentNotePath, 2);
  }, [currentNotePath, revealFolder, shouldShowSearchResults]);

  useEffect(() => {
    if (previousSearchQueryRef.current !== search.searchQuery) {
      previousSearchQueryRef.current = search.searchQuery;
      setActiveSearchResultId(null);
    }

    if (search.isSearchOpen && search.searchQuery.trim().length > 0) {
      return;
    }

    clearSidebarSearchHighlights();
    clearSidebarSearchNavigationPending();
    setPendingNavigation(null);
    setActiveSearchResultId(null);
  }, [search.isSearchOpen, search.searchQuery]);

  useEffect(() => {
    if (!activeSearchResultId) {
      return;
    }

    if (!searchResults.some((result) => result.id === activeSearchResultId)) {
      setActiveSearchResultId(null);
    }
  }, [activeSearchResultId, searchResults]);

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
      shouldContinue: () => !cancelled,
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
    const targetPath = result.openPath ?? result.path;
    const isSameNote = currentNotePath === targetPath;
    const previousView = isSameNote ? null : getCurrentEditorView();
    const nextNavigation = {
      path: targetPath,
      query: deferredSearchQuery,
      contentMatchOrdinal: result.contentMatchOrdinal,
      previousView,
    };

    if (!isSameNote) {
      markSidebarSearchNavigationPending(targetPath);
    }
    setPendingNavigation(nextNavigation);
    setActiveSearchResultId(result.id);

    if (isSameNote) {
      return;
    }

    const openPromise = result.isExternal
      ? openNoteByAbsolutePath(targetPath)
      : openNote(targetPath);

    void openPromise.catch(() => {
      clearSidebarSearchNavigationPending(targetPath);
      setActiveSearchResultId((current) => (current === result.id ? null : current));
      setPendingNavigation((current) =>
        current === nextNavigation ? null : current,
      );
    });
  };

  const handleOpenMarkdownFile = () => {
    window.dispatchEvent(new Event('vlaina-open-markdown-target-file'));
  };

  const handleOpenFolder = () => {
    window.dispatchEvent(new Event('vlaina-open-markdown-target-folder'));
  };

  return (
    <div
      ref={sidebarRootRef}
      className={cn('group/sidebar-content relative flex h-full flex-col', className)}
    >
      <SidebarSearchDrawer
        isSearchOpen={search.isSearchOpen}
        shouldShowTopActions={false}
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
        topActions={null}
      />

      <SidebarCapsulePanel>
        {!shouldShowSearchResults ? <NotesSidebarTopActions /> : null}

        <NotesSidebarScrollArea
          ref={scrollRootRef}
          className={cn(isPeeking ? 'vlaina-scrollbar-rounded pt-4 pb-4' : 'pt-2')}
          scrollbarInsetRight={SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT}
          data-notes-sidebar-scroll-root="true"
          onScroll={handleScroll}
        >
          {shouldShowSearchResults ? (
            <SidebarSearchResultsList
              results={searchResults}
              query={deferredSearchQuery}
              currentNotePath={currentNotePath}
              activeResultId={activeSearchResultId}
              onOpen={handleOpenSearchResult}
              scrollRootRef={scrollRootRef}
              isContentScanPending={isContentScanPending}
            />
          ) : (
            <div className="relative flex min-h-full flex-col">
              <StarredSection showTitle={false} />
              <RootFolderRow
                rootFolder={displayRootFolder}
                isLoading={isLoading}
                onCreateNote={createNote}
                onCreateFolder={() => createFolder('')}
                blankContextMenuRef={rootBlankAreaRef}
                scrollRootRef={scrollRootRef}
              />
              <div
                ref={rootBlankAreaRef}
                data-notes-sidebar-blank-drag-root="true"
                className={cn(
                  'flex flex-1 justify-center',
                  hasFileTreeEntries ? 'min-h-0 items-center' : 'min-h-[160px] items-end',
                )}
              >
              </div>
            </div>
          )}
        </NotesSidebarScrollArea>
      </SidebarCapsulePanel>
      {shouldShowEmptyHint ? (
        <div className="pointer-events-none fixed bottom-5 left-4 z-50 flex w-[calc(var(--vlaina-shell-sidebar-width)-32px)] justify-center">
          <NotesSidebarHoverEmptyHint
            title=""
            actions={[
              { label: 'File', onAction: handleOpenMarkdownFile },
              { label: 'Folder', onAction: handleOpenFolder },
            ]}
            placement="inline"
            visible
          />
        </div>
      ) : null}
    </div>
  );
}
