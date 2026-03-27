import { useMemo, useRef } from 'react';
import { StarredSection } from '../Starred';
import { WorkspaceSection } from '../FileTree';
import { cn } from '@/lib/utils';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { NotesSidebarScrollArea } from './NotesSidebarPrimitives';
import { NotesSidebarRow } from './NotesSidebarRow';
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { Icon } from '@/components/ui/icons';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import { SidebarSearchField } from '@/components/layout/sidebar/SidebarPrimitives';
import { useSidebarSearchControls } from '@/components/layout/sidebar/useSidebarSearchControls';
import {
  buildNotesSidebarSearchResults,
  useNotesSidebarSearchState,
} from './notesSidebarSearch';

interface SidebarContentProps {
  rootFolder: FolderNode | null;
  isLoading: boolean;
  currentNotePath?: string | null;
  createNote: () => void;
  createFolder: (path: string) => void;
  className?: string;
  isPeeking?: boolean;
}

export function SidebarContent({
  rootFolder,
  isLoading,
  currentNotePath,
  createNote,
  createFolder,
  className,
  isPeeking = false,
}: SidebarContentProps) {
  const openNote = useNotesStore((s) => s.openNote);
  const getDisplayName = useNotesStore((s) => s.getDisplayName);
  const { isSearchOpen, searchQuery, setSearchQuery, openSearch, closeSearch } =
    useNotesSidebarSearchState();
  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const {
    inputRef,
    scrollRootRef,
    hideSearch,
    handleScroll,
    handleWheelCapture,
  } = useSidebarSearchControls({
    isOpen: isSearchOpen,
    query: searchQuery,
    onOpen: openSearch,
    onClose: closeSearch,
  });

  useHeldPageScroll(scrollRootRef, {
    scopeRef: sidebarRootRef,
    ignoreEditableTargets: true,
  });

  const searchResults = useMemo(
    () => buildNotesSidebarSearchResults(rootFolder, searchQuery, getDisplayName),
    [getDisplayName, rootFolder, searchQuery],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  const handleOpenResult = (path: string) => {
    void openNote(path);
    hideSearch();
  };

  return (
    <div ref={sidebarRootRef} className={cn('flex h-full flex-col', className)}>
      {!isSearchOpen ? (
        <NotesSidebarTopActions />
      ) : null}

      {isSearchOpen ? (
        <SidebarSearchField
          ref={inputRef}
          autoFocus
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              hideSearch();
              return;
            }
            if (event.key === 'Enter' && searchResults[0]) {
              event.preventDefault();
              handleOpenResult(searchResults[0].path);
            }
          }}
          placeholder="Search notes..."
          onClose={hideSearch}
          closeLabel="Close sidebar search"
        />
      ) : null}

      <NotesSidebarScrollArea
        ref={scrollRootRef}
        className={cn(isPeeking ? 'vlaina-scrollbar-rounded pt-4 pb-4' : 'pt-2')}
        data-notes-sidebar-scroll-root="true"
        onScroll={handleScroll}
        onWheelCapture={handleWheelCapture}
      >
        {isSearchOpen ? (
          hasSearchQuery && searchResults.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {searchResults.map((result) => (
                <NotesSidebarRow
                  key={result.path}
                  leading={<Icon name="file.text" size="sidebar" className="text-[var(--notes-sidebar-file-icon)]" />}
                  isActive={result.path === currentNotePath}
                  onClick={() => handleOpenResult(result.path)}
                  main={(
                    <div className="min-w-0">
                      <div className={cn('truncate', result.path === currentNotePath && 'font-medium text-[var(--notes-sidebar-text)]')}>
                        {result.name}
                      </div>
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
          <>
            <StarredSection />
            <WorkspaceSection
              rootFolder={rootFolder}
              isLoading={isLoading}
              currentNotePath={currentNotePath ?? undefined}
              onCreateNote={createNote}
              onCreateFolder={() => createFolder('')}
            />
          </>
        )}
      </NotesSidebarScrollArea>
    </div>
  );
}
