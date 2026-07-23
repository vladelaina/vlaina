import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesBlankWorkspaceDropLifecycle } from './useNotesBlankWorkspaceDropLifecycle';

const mocks = vi.hoisted(() => ({
  blankDropOpen: vi.fn(),
  sidebarDropImport: vi.fn(),
  notesStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));

vi.mock('./hooks/useBlankWorkspaceDropOpen', () => ({
  useBlankWorkspaceDropOpen: mocks.blankDropOpen,
}));

vi.mock('./hooks/useNotesSidebarExternalDropImport', () => ({
  useNotesSidebarExternalDropImport: mocks.sidebarDropImport,
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: mocks.notesStore,
}));

describe('useNotesBlankWorkspaceDropLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.blankDropOpen.mockReturnValue(false);
    mocks.notesStore.getState.mockReturnValue({
      currentNote: { path: 'draft:test' },
      openTabs: [{ path: 'draft:test' }],
    });
  });

  it('keeps sidebar file import enabled while an empty draft is shown', () => {
    renderHook(() => useNotesBlankWorkspaceDropLifecycle({
      active: true,
      blankDropDraftHasUnsavedChanges: false,
      currentNotePath: 'draft:test',
      currentNotesRoot: { path: '/notesRoot' },
      draftNotes: { 'draft:test': { parentPath: null, name: 'Untitled' } },
      isLoading: false,
      isNotesRootInitializing: false,
      isOpenTargetBusy: false,
      launchNotePath: null,
      loadFileTree: vi.fn(),
      notesPath: '/notesRoot',
      notesRootInitializing: false,
      notesRootStoreHasInitialized: true,
      openMarkdownTarget: vi.fn(),
      openNotesRoot: vi.fn(),
      openTabs: [{ path: 'draft:test', name: 'Untitled', isDirty: false }],
      pendingStarredNavigation: null,
      revealFolder: vi.fn(),
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      },
      rootFolderPath: '/notesRoot',
    }));

    expect(mocks.sidebarDropImport).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      notesRootPath: '/notesRoot',
    }));
  });
});
