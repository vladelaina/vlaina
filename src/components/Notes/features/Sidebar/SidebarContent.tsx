import { useLayoutEffect, useMemo, useRef } from 'react';
import { StarredSection } from '../Starred';
import { WorkspaceSection } from '../FileTree';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore, type FileTreeNode, type FolderNode } from '@/stores/useNotesStore';
import { NotesSidebarScrollArea } from './NotesSidebarPrimitives';
import { NotesSidebarRow } from './NotesSidebarRow';

interface SearchResult {
  path: string;
  name: string;
  preview: string;
  matchIndex: number;
}

function collectIndexedNotes(
  children: FileTreeNode[],
  getDisplayName: (path: string) => string,
  parentPath = '',
  bucket: SearchResult[] = [],
) {
  for (const node of children) {
    if (node.isFolder) {
      collectIndexedNotes(node.children, getDisplayName, node.path, bucket);
      continue;
    }

    bucket.push({
      path: node.path,
      name: getDisplayName(node.path) || node.name,
      preview: parentPath ? `${parentPath}/` : '',
      matchIndex: 0,
    });
  }

  return bucket;
}

function buildSearchResults(
  rootFolder: FolderNode | null,
  query: string,
  getDisplayName: (path: string) => string,
) {
  if (!rootFolder || !query.trim()) return [];

  const lowerQuery = query.trim().toLowerCase();

  return collectIndexedNotes(rootFolder.children, getDisplayName)
    .map((result) => ({
      ...result,
      matchIndex: result.name.toLowerCase().indexOf(lowerQuery),
    }))
    .filter((result) => result.matchIndex !== -1)
    .sort((a, b) => a.matchIndex - b.matchIndex || a.name.localeCompare(b.name))
    .slice(0, 12);
}

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
  const isSearchOpen = useUIStore((s) => s.notesSidebarSearchOpen);
  const setSearchOpen = useUIStore((s) => s.setNotesSidebarSearchOpen);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const setAppViewMode = useUIStore((s) => s.setAppViewMode);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overscrollDistanceRef = useRef(0);

  const searchResults = useMemo(
    () => buildSearchResults(rootFolder, searchQuery, getDisplayName),
    [getDisplayName, rootFolder, searchQuery],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  useLayoutEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isSearchOpen]);

  const hideSearch = () => {
    overscrollDistanceRef.current = 0;
    setSearchOpen(false);
    setSearchQuery('');
  };

  const handleOpenResult = (path: string) => {
    void openNote(path);
    hideSearch();
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {!isSearchOpen ? (
        <div className="px-1 pt-1 pb-1">
          <button
            type="button"
            onClick={() => setAppViewMode('chat')}
            className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-xl bg-transparent px-3 py-2 text-sm font-medium text-[var(--chat-sidebar-text-muted)] shadow-none transition-colors hover:bg-[var(--notes-sidebar-row-hover)] hover:shadow-none"
          >
            <Icon name="common.sparkle" size="md" className="text-[var(--chat-sidebar-text-muted)]" />
            <span className="truncate">Chat</span>
          </button>
        </div>
      ) : null}

      {isSearchOpen ? (
        <div className="px-2 pt-2">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--neko-border)] bg-white px-3 py-1 shadow-none">
            <Icon name="common.search" size="md" className="text-[var(--neko-text-tertiary)]" />
            <input
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
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--neko-text-primary)] outline-none placeholder:text-[var(--neko-text-tertiary)]"
            />
              <button
                type="button"
                onClick={() => hideSearch()}
                aria-label="Close sidebar search"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--neko-text-tertiary)] transition-colors hover:bg-[var(--neko-hover)] hover:text-[var(--neko-text-primary)]"
              >
              <Icon name="common.close" size="md" />
            </button>
          </div>
        </div>
      ) : null}

      <NotesSidebarScrollArea
        className={cn(isPeeking ? 'neko-scrollbar-rounded pt-4 pb-4' : 'pt-2')}
        data-notes-sidebar-scroll-root="true"
        onScroll={(event) => {
          const currentTarget = event.currentTarget;
          if (currentTarget.scrollTop > 0) {
            overscrollDistanceRef.current = 0;
          }
        }}
        onWheelCapture={(event) => {
          const currentTarget = event.currentTarget;
          if (isSearchOpen) {
            if (currentTarget.scrollTop === 0 && event.deltaY < 0) {
              event.preventDefault();
              return;
            }
            if (currentTarget.scrollTop === 0 && event.deltaY > 0 && !searchQuery.trim()) {
              hideSearch();
            }
            return;
          }

          if (currentTarget.scrollTop > 0) {
            overscrollDistanceRef.current = 0;
            return;
          }
          if (event.deltaY >= 0) {
            overscrollDistanceRef.current = 0;
            return;
          }

          overscrollDistanceRef.current += Math.abs(event.deltaY);
          if (overscrollDistanceRef.current < 56) {
            return;
          }

          event.preventDefault();
          setSearchOpen(true);
        }}
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
