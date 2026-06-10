import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  NOTES_SIDEBAR_MAX_SEARCH_RESULTS,
} from './notesSidebarSearchResults';
import { useSidebarContentSearchResults } from './useSidebarContentSearchResults';

function createRootFolder(noteCount: number, namePrefix: string): FolderNode {
  return {
    id: 'root',
    name: 'Notes',
    path: '',
    isFolder: true,
    expanded: true,
    children: Array.from({ length: noteCount }, (_, index) => ({
      id: `note-${index}`,
      name: `${namePrefix}-${index}.md`,
      path: `docs/${namePrefix}-${index}.md`,
      isFolder: false,
    })),
  };
}

describe('useSidebarContentSearchResults', () => {
  it('does not scan note contents when structural results fill the result limit', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    const { result } = renderHook(() => useSidebarContentSearchResults({
      rootFolder: createRootFolder(NOTES_SIDEBAR_MAX_SEARCH_RESULTS + 10, 'alpha'),
      getDisplayName: (path) => path.split('/').pop() ?? path,
      noteContentsCache: new Map(),
      scanAllNotes,
      cancelNoteContentScan: vi.fn(),
      pruneNoteContentsCacheToOpenNotes: vi.fn(),
      searchQuery: 'alpha',
      isSearchOpen: true,
    }));

    await waitFor(() => {
      expect(result.current.searchResults).toHaveLength(NOTES_SIDEBAR_MAX_SEARCH_RESULTS);
    });
    expect(scanAllNotes).not.toHaveBeenCalled();
    expect(result.current.isContentScanPending).toBe(false);
  });

  it('scans note contents when visible structural results do not fill the result limit', async () => {
    const scanAllNotes = vi.fn(() => new Promise<void>(() => {}));

    const { result } = renderHook(() => useSidebarContentSearchResults({
      rootFolder: createRootFolder(2, 'alpha'),
      getDisplayName: (path) => path.split('/').pop() ?? path,
      noteContentsCache: new Map(),
      scanAllNotes,
      cancelNoteContentScan: vi.fn(),
      pruneNoteContentsCacheToOpenNotes: vi.fn(),
      searchQuery: 'alpha',
      isSearchOpen: true,
    }));

    await waitFor(() => {
      expect(scanAllNotes).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isContentScanPending).toBe(true);
  });
});
