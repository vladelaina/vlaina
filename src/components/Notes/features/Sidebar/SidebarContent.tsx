import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import { useUIStore } from '@/stores/uiSlice';
import { isDraftNoteEmpty, isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import { StarredSection } from '../Starred';
import { triggerHoveredSidebarRename } from '../common/sidebarHoverRename';
import {
  NotesSidebarHoverEmptyHint,
  NotesSidebarPillEmptyHint,
  NotesSidebarScrollArea,
} from './NotesSidebarPrimitives';
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { type NotesSidebarSearchResult } from './notesSidebarSearchResults';
import {
  consumeSuppressedCurrentNoteSidebarReveal,
  scheduleSidebarItemIntoView,
} from '../common/sidebarScrollIntoView';
import { useSidebarContentSearchResults } from './useSidebarContentSearchResults';
import { useI18n } from '@/lib/i18n';

const EMPTY_NOTE_CONTENTS_CACHE = new Map<string, { content: string; modifiedAt: number | null }>();
const SidebarSearchResultsList = lazy(async () => {
  const mod = await import('./SidebarSearchResultsList');
  return { default: mod.SidebarSearchResultsList };
});
const RootFolderRow = lazy(async () => {
  const mod = await import('./RootFolderRow');
  return { default: mod.RootFolderRow };
});
type CurrentEditorView = Awaited<
  ReturnType<typeof import('../Editor/utils/editorViewRegistry')['getCurrentEditorView']>
>;

interface SidebarContentProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string | null;
  createNote: () => Promise<unknown>;
  createFolder: (path: string) => Promise<string | null>;
  search: SidebarSearchState;
  className?: string;
  isPeeking?: boolean;
  active?: boolean;
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
  active = true,
}: SidebarContentProps) {
  const { t } = useI18n();
  const openNote = useNotesStore((s) => s.openNote);
  const openNoteByAbsolutePath = useNotesStore((s) => s.openNoteByAbsolutePath);
  const draftNotes = useNotesStore((s) => s.draftNotes);
  const revealFolder = useNotesStore((s) => s.revealFolder);
  const getDisplayName = useNotesStore((s) => s.getDisplayName);
  const notesPath = useNotesStore((s) => s.notesPath);
  const scanAllNotes = useNotesStore((s) => s.scanAllNotes);
  const cancelNoteContentScan = useNotesStore((s) => s.cancelNoteContentScan);
  const pruneNoteContentsCacheToOpenNotes = useNotesStore((s) => s.pruneNoteContentsCacheToOpenNotes);
  const starredEntries = useNotesStore((s) => s.starredEntries);
  const currentVault = useVaultStore((s) => s.currentVault);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const effectiveSearchOpen = active && search.isSearchOpen;
  const effectiveSearchQuery = active ? search.searchQuery : '';
  const previousSearchQueryRef = useRef(effectiveSearchQuery);
  const deferredSearchQuery = useDeferredValue(effectiveSearchQuery);
  const isCurrentDraftNote = Boolean(currentNotePath && isDraftNotePath(currentNotePath));
  const shouldSubscribeToSearchContents =
    effectiveSearchOpen && deferredSearchQuery.trim().length >= 2;
  const noteContentsCache = useNotesStore((s) =>
    shouldSubscribeToSearchContents ? s.noteContentsCache : EMPTY_NOTE_CONTENTS_CACHE
  );
  const currentDraftContent = useNotesStore((s) =>
    currentNotePath && isDraftNotePath(currentNotePath)
      ? s.noteContentsCache.get(currentNotePath)?.content ?? ''
      : ''
  );
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const rootBlankAreaRef = useRef<HTMLDivElement | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{
    path: string;
    query: string;
    contentMatchOrdinal: number | null;
    previousView: CurrentEditorView;
  } | null>(null);
  const [activeSearchResultId, setActiveSearchResultId] = useState<string | null>(null);
  const [selectedSearchResultIndex, setSelectedSearchResultIndex] = useState(0);
  const displayRootFolder = useMemo(() => {
    if (!currentNotePath || !isCurrentDraftNote) {
      return rootFolder;
    }

    const draftEntry = draftNotes[currentNotePath];
    if (!draftEntry) {
      return rootFolder;
    }

    if (
      rootFolder &&
      rootFolder.children.length === 0 &&
      !draftEntry.name.trim() &&
      isDraftNoteEmpty(currentDraftContent)
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
  }, [currentDraftContent, currentNotePath, draftNotes, isCurrentDraftNote, rootFolder]);
  const {
    inputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
    shouldShowSearchResults,
  } = useSidebarSearchDrawerState({
    enabled: active,
    isOpen: effectiveSearchOpen,
    query: effectiveSearchQuery,
    onOpen: search.openSearch,
    onClose: search.closeSearch,
    scopeRef: sidebarRootRef,
  });
  const wasShowingSearchResultsRef = useRef(shouldShowSearchResults);
  const lastRevealedCurrentNotePathRef = useRef<string | null>(null);
  const hasVaultPendingRoot = Boolean(currentVault && notesPath === currentVault.path && !displayRootFolder);
  const hasFileTreeEntries = Boolean(displayRootFolder && displayRootFolder.children.length > 0);
  const { isContentScanPending, searchResults } = useSidebarContentSearchResults({
    rootFolder: displayRootFolder,
    getDisplayName,
    noteContentsCache,
    scanAllNotes,
    cancelNoteContentScan,
    pruneNoteContentsCacheToOpenNotes,
    searchQuery: deferredSearchQuery,
    isSearchOpen: effectiveSearchOpen,
    starredEntries,
    currentVaultPath: currentVault?.path ?? notesPath,
  });
  const hasLoadedRootFolder = Boolean(displayRootFolder);
  const shouldShowInlineEmptyHint = !isLoading && hasLoadedRootFolder && !hasFileTreeEntries;
  const shouldShowFloatingEmptyHint = !isLoading && !hasVaultPendingRoot && !hasLoadedRootFolder;
  const shouldRenderRootFolderRow = Boolean(
    displayRootFolder || hasVaultPendingRoot || shouldShowInlineEmptyHint,
  );

  useEffect(() => {
    if (!active) {
      return;
    }

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
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const wasShowingSearchResults = wasShowingSearchResultsRef.current;
    wasShowingSearchResultsRef.current = shouldShowSearchResults;
    const justLeftSearchResults = wasShowingSearchResults && !shouldShowSearchResults;

    if (
      shouldShowSearchResults ||
      !currentNotePath ||
      isDraftNotePath(currentNotePath) ||
      isAbsolutePath(currentNotePath) ||
      !displayRootFolder
    ) {
      return;
    }

    if (!justLeftSearchResults && lastRevealedCurrentNotePathRef.current === currentNotePath) {
      return;
    }

    lastRevealedCurrentNotePathRef.current = currentNotePath;
    if (consumeSuppressedCurrentNoteSidebarReveal(currentNotePath, scrollRootRef.current)) {
      return;
    }

    revealFolder(currentNotePath);
    scheduleSidebarItemIntoView(currentNotePath, 3);
  }, [active, currentNotePath, displayRootFolder, revealFolder, shouldShowSearchResults]);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (previousSearchQueryRef.current !== effectiveSearchQuery) {
      previousSearchQueryRef.current = effectiveSearchQuery;
      setActiveSearchResultId(null);
      setSelectedSearchResultIndex(0);
    }

    if (effectiveSearchOpen && effectiveSearchQuery.trim().length > 0) {
      return;
    }

    void import('./sidebarSearchNavigation').then((mod) => {
      mod.clearSidebarSearchHighlights();
      mod.clearSidebarSearchNavigationPending();
    });
    setPendingNavigation(null);
    setActiveSearchResultId(null);
    setSelectedSearchResultIndex(0);
  }, [active, effectiveSearchOpen, effectiveSearchQuery]);

  useEffect(() => {
    if (!activeSearchResultId) {
      return;
    }

    if (!searchResults.some((result) => result.id === activeSearchResultId)) {
      setActiveSearchResultId(null);
    }
  }, [activeSearchResultId, searchResults]);

  useEffect(() => {
    setSelectedSearchResultIndex((current) => {
      if (!active || searchResults.length === 0) {
        return 0;
      }

      return Math.min(current, searchResults.length - 1);
    });
  }, [active, searchResults.length]);

  useEffect(() => {
    if (!pendingNavigation || currentNotePath !== pendingNavigation.path) {
      return;
    }

    let cancelled = false;

    void import('./sidebarSearchNavigation')
      .then((mod) => mod.applySidebarSearchNavigation({
        path: pendingNavigation.path,
        query: pendingNavigation.query,
        contentMatchOrdinal: pendingNavigation.contentMatchOrdinal,
        previousView: pendingNavigation.previousView,
        shouldContinue: () => !cancelled,
      }))
      .finally(() => {
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
    void Promise.all([
      import('../Editor/utils/editorViewRegistry'),
      import('./sidebarSearchNavigation'),
    ]).then(([editorViewRegistry, searchNavigation]) => {
      const previousView = isSameNote ? null : editorViewRegistry.getCurrentEditorView();
      const nextNavigation = {
        path: targetPath,
        query: deferredSearchQuery,
        contentMatchOrdinal: result.contentMatchOrdinal,
        previousView,
      };

      if (!isSameNote) {
        searchNavigation.markSidebarSearchNavigationPending(targetPath);
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
        searchNavigation.clearSidebarSearchNavigationPending(targetPath);
        setActiveSearchResultId((current) => (current === result.id ? null : current));
        setPendingNavigation((current) =>
          current === nextNavigation ? null : current,
        );
      });
    });
  };

  const selectedSearchResult = searchResults[selectedSearchResultIndex] ?? null;

  const selectPreviousSearchResult = () => {
    setSelectedSearchResultIndex((current) => {
      if (searchResults.length === 0) {
        return 0;
      }

      return (current - 1 + searchResults.length) % searchResults.length;
    });
  };

  const selectNextSearchResult = () => {
    setSelectedSearchResultIndex((current) => {
      if (searchResults.length === 0) {
        return 0;
      }

      return (current + 1) % searchResults.length;
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
      className={cn('group/sidebar-content relative flex h-full min-h-0 flex-col', className)}
    >
      <SidebarSearchDrawer
        isSearchOpen={effectiveSearchOpen}
        shouldShowTopActions={false}
        searchQuery={effectiveSearchQuery}
        setSearchQuery={search.setSearchQuery}
        inputRef={inputRef}
        hideSearch={hideSearch}
        canSubmit={Boolean(selectedSearchResult)}
        onSubmit={() => {
          const result = selectedSearchResult;
          if (!result) {
            return;
          }
          handleOpenSearchResult(result);
        }}
        canSelectPrevious={searchResults.length > 0}
        canSelectNext={searchResults.length > 0}
        onSelectPrevious={selectPreviousSearchResult}
        onSelectNext={selectNextSearchResult}
        placeholder=""
        closeLabel={t('notes.closeSidebarSearch')}
        topActions={null}
      />

      <SidebarCapsulePanel>
        {!shouldShowSearchResults ? <NotesSidebarTopActions /> : null}

        <NotesSidebarScrollArea
          ref={scrollRootRef}
          className={cn(isPeeking ? 'vlaina-scrollbar-rounded pt-4 pb-4' : 'pt-0')}
          scrollbarInsetRight={SIDEBAR_CAPSULE_SCROLLBAR_INSET_RIGHT}
          data-notes-sidebar-scroll-root="true"
          onScroll={handleScroll}
        >
          {shouldShowSearchResults ? (
            <Suspense fallback={null}>
              <SidebarSearchResultsList
                results={searchResults}
                query={deferredSearchQuery}
                currentNotePath={currentNotePath}
                activeResultId={activeSearchResultId}
                highlightedResultId={selectedSearchResult?.id ?? null}
                onOpen={handleOpenSearchResult}
                scrollRootRef={scrollRootRef}
                isContentScanPending={isContentScanPending}
              />
            </Suspense>
          ) : (
            <div className="relative flex min-h-full flex-col">
              <StarredSection showTitle={false} />
              {shouldRenderRootFolderRow ? (
                <Suspense fallback={null}>
                  <RootFolderRow
                    rootFolder={displayRootFolder}
                    isLoading={isLoading}
                    onCreateNote={createNote}
                    onCreateFolder={() => createFolder('')}
                    blankContextMenuRef={rootBlankAreaRef}
                    scrollRootRef={scrollRootRef}
                    active={active}
                  />
                </Suspense>
              ) : null}
              <div
                ref={rootBlankAreaRef}
                data-notes-sidebar-blank-drag-root="true"
                className={cn(
                  'flex flex-1 justify-center',
                  hasFileTreeEntries ? 'min-h-0 items-center' : 'min-h-[160px] items-center',
                )}
              >
                {shouldShowInlineEmptyHint ? (
                  <NotesSidebarPillEmptyHint
                    actions={[
                      { label: t('notes.file'), onAction: handleOpenMarkdownFile },
                      { label: t('notes.folder'), onAction: handleOpenFolder },
                    ]}
                  />
                ) : null}
              </div>
            </div>
          )}
        </NotesSidebarScrollArea>
      </SidebarCapsulePanel>
      {shouldShowFloatingEmptyHint && !sidebarCollapsed ? (
        <div className="pointer-events-none fixed bottom-5 left-4 z-50 flex w-[calc(var(--vlaina-shell-sidebar-width)-32px)] justify-center">
          <NotesSidebarHoverEmptyHint
            actions={[
              { label: t('notes.file'), onAction: handleOpenMarkdownFile },
              { label: t('notes.folder'), onAction: handleOpenFolder },
            ]}
            placement="inline"
            visible
          />
        </div>
      ) : null}
    </div>
  );
}
