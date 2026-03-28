import { useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useNotesStore, type FolderNode } from '@/stores/useNotesStore';
import { NotesSidebarScrollArea } from './NotesSidebarPrimitives';
import { NotesSidebarRow } from './NotesSidebarRow';
import { NotesSidebarTopActions } from './NotesSidebarTopActions';
import { Icon } from '@/components/ui/icons';
import { StarredSection } from '../Starred';
import { RootFolderRow } from './RootFolderRow';
import { NOTES_SIDEBAR_ICON_SIZE } from './sidebarLayout';
import { NoteDisambiguatedTitle } from '../common/noteDisambiguation';
import {
  SidebarSearchDrawer,
  useSidebarSearchDrawerState,
} from '@/components/layout/sidebar/SidebarSearchDrawer';
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
    shouldShowSearchResults,
  } = useSidebarSearchDrawerState({
    isOpen: isSearchOpen,
    query: searchQuery,
    onOpen: openSearch,
    onClose: closeSearch,
    scopeRef: sidebarRootRef,
  });

  const searchResults = useMemo(
    () => buildNotesSidebarSearchResults(rootFolder, searchQuery, getDisplayName),
    [getDisplayName, rootFolder, searchQuery],
  );

  const handleOpenResult = (path: string) => {
    void openNote(path);
    hideSearch();
  };

  return (
    <div ref={sidebarRootRef} className={cn('flex h-full flex-col', className)}>
      <SidebarSearchDrawer
        isSearchOpen={isSearchOpen}
        shouldShowTopActions={!shouldShowSearchResults}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
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
