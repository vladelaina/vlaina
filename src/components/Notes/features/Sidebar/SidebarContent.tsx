import { useEffect, useMemo, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import {
  SidebarSearchDrawer,
  useSidebarSearchDrawerState,
} from '@/components/layout/sidebar/SidebarSearchDrawer';
import type { SidebarSearchState } from '@/components/layout/sidebar/useSidebarSearchState';
import { cn } from '@/lib/utils';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { StarredSection } from '../Starred';
import { NoteDisambiguatedTitle } from '../common/noteDisambiguation';
import { triggerHoveredSidebarRename } from '../common/sidebarHoverRename';
import { NotesSidebarRow } from './NotesSidebarRow';
import { NotesSidebarScrollArea } from './NotesSidebarPrimitives';
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { RootFolderRow } from './RootFolderRow';
import {
  buildNotesSidebarSearchIndex,
  queryNotesSidebarSearch,
} from './notesSidebarSearchResults';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';

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
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
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

  const searchResults = useMemo(
    () => queryNotesSidebarSearch(searchIndex, search.searchQuery),
    [search.searchQuery, searchIndex],
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

  const handleOpenResult = (path: string) => {
    void openNote(path);
    hideSearch();
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
          handleOpenResult(result.path);
        }}
        placeholder="Search notes..."
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
          searchResults.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {searchResults.map((result) => (
                <NotesSidebarRow
                  key={result.path}
                  leading={<Icon name="file.text" size={NOTES_SIDEBAR_ICON_SIZE} className="text-[var(--notes-sidebar-file-icon)]" />}
                  isActive={result.path === currentNotePath}
                  onClick={() => handleOpenResult(result.path)}
                  main={(
                    <div className="min-w-0">
                      <NoteDisambiguatedTitle
                        path={result.path}
                        fallbackName={result.name}
                        className={cn(result.path === currentNotePath && 'text-[var(--notes-sidebar-text)]')}
                        titleClassName={cn(result.path === currentNotePath && 'font-medium')}
                        hintClassName="text-[var(--notes-sidebar-text-soft)]"
                      />
                      {result.preview ? (
                        <div className="truncate text-[11px] text-[var(--notes-sidebar-text-soft)]">
                          {result.preview}
                        </div>
                      ) : null}
                    </div>
                  )}
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
