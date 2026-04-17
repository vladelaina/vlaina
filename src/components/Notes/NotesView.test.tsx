import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchDeleteCurrentNoteEvent } from '@/components/Notes/noteDeleteEvents';
import { NotesView } from './NotesView';

type MockNotesState = {
  currentNote: { path: string; content: string } | null;
  loadFileTree: ReturnType<typeof vi.fn>;
  openTabs: Array<{ path: string; name: string; isDirty: boolean }>;
  closeTab: ReturnType<typeof vi.fn>;
  createNote: ReturnType<typeof vi.fn>;
  openNote: ReturnType<typeof vi.fn>;
  deleteNote: ReturnType<typeof vi.fn>;
  loadStarred: ReturnType<typeof vi.fn>;
  loadMetadata: ReturnType<typeof vi.fn>;
  loadAssets: ReturnType<typeof vi.fn>;
  saveNote: ReturnType<typeof vi.fn>;
  cleanupAssetTempFiles: ReturnType<typeof vi.fn>;
  clearAssetUrlCache: ReturnType<typeof vi.fn>;
  revealFolder: ReturnType<typeof vi.fn>;
  isDirty: boolean;
  pendingStarredNavigation: null;
  setPendingStarredNavigation: ReturnType<typeof vi.fn>;
  notesPath: string;
  rootFolder: {
    id: string;
    name: string;
    path: string;
    isFolder: true;
    children: unknown[];
    expanded: boolean;
  } | null;
  draftNotes: Record<string, { parentPath: string | null; name: string }>;
  isLoading: boolean;
  openNoteByAbsolutePath: ReturnType<typeof vi.fn>;
  pendingDraftDiscardPath: string | null;
  cancelPendingDraftDiscard: ReturnType<typeof vi.fn>;
  confirmPendingDraftDiscard: ReturnType<typeof vi.fn>;
  getDisplayName: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const notesState: MockNotesState = {
    currentNote: null,
    loadFileTree: vi.fn().mockResolvedValue(undefined),
    openTabs: [],
    closeTab: vi.fn(),
    createNote: vi.fn().mockResolvedValue('draft:test'),
    openNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    loadStarred: vi.fn().mockResolvedValue(undefined),
    loadMetadata: vi.fn().mockResolvedValue(undefined),
    loadAssets: vi.fn().mockResolvedValue(undefined),
    saveNote: vi.fn().mockResolvedValue(undefined),
    cleanupAssetTempFiles: vi.fn().mockResolvedValue(undefined),
    clearAssetUrlCache: vi.fn(),
    revealFolder: vi.fn(),
    isDirty: false,
    pendingStarredNavigation: null,
    setPendingStarredNavigation: vi.fn(),
    notesPath: '/vault',
    rootFolder: {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [],
      expanded: true,
    },
    draftNotes: {},
    isLoading: false,
    openNoteByAbsolutePath: vi.fn().mockResolvedValue(undefined),
    pendingDraftDiscardPath: null,
    cancelPendingDraftDiscard: vi.fn(),
    confirmPendingDraftDiscard: vi.fn(),
    getDisplayName: vi.fn((path: string) => path.split('/').pop() || path),
  };

  const vaultState = {
    currentVault: { path: '/vault' } as { path: string } | null,
    openVault: vi.fn(),
  };

  const uiState = {
    sidebarWidth: 320,
    notesChatPanelCollapsed: true,
    setNotesChatPanelCollapsed: vi.fn(),
    toggleNotesChatPanel: vi.fn(),
    setLayoutPanelDragging: vi.fn(),
  };

  return {
    notesState,
    vaultState,
    uiState,
  };
});

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector: (state: MockNotesState) => unknown) => selector(mocks.notesState),
    {
      getState: () => mocks.notesState,
    },
  ),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector?: (state: typeof mocks.vaultState) => unknown) =>
    selector ? selector(mocks.vaultState) : mocks.vaultState,
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: typeof mocks.uiState) => unknown) => selector(mocks.uiState),
}));

vi.mock('@/lib/tauri/invoke', () => ({
  windowCommands: {
    setResizable: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/storage/dialog', () => ({
  openDialog: vi.fn(),
  messageDialog: vi.fn(),
}));

vi.mock('@/lib/notes/openMarkdownFileText', () => ({
  OPEN_MARKDOWN_FILE_ACTION: 'Open Markdown File',
}));

vi.mock('./features/OpenTarget/openTargetSelection', () => ({
  getSingleOpenSelection: vi.fn(),
  isSupportedMarkdownSelection: vi.fn(),
  resolveOpenNoteTarget: vi.fn(),
}));

vi.mock('@/lib/shortcuts', () => ({
  matchesShortcutBinding: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/ui/composerFocusRegistry', () => ({
  focusComposerInput: vi.fn().mockReturnValue(false),
}));

vi.mock('@/components/layout/ResizablePanel', () => ({
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/ModuleShortcutsDialog', () => ({
  ModuleShortcutsDialog: () => null,
}));

vi.mock('@/lib/tauri/windowLaunchContext', () => ({
  readWindowLaunchContext: vi.fn(() => ({})),
}));

vi.mock('./features/Editor', () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

vi.mock('@/hooks/useModuleShortcutsDialog', () => ({
  useModuleShortcutsDialog: vi.fn(),
}));

vi.mock('@/components/Chat/features/Temporary/temporaryChatCommands', () => ({
  runOpenNewChatShortcut: vi.fn(),
  runTemporaryChatWelcomeShortcut: vi.fn(),
}));

vi.mock('./hooks/useCurrentVaultExternalPathSync', () => ({
  useCurrentVaultExternalPathSync: vi.fn(),
}));

vi.mock('./hooks/useNotesExternalSync', () => ({
  useNotesExternalSync: vi.fn(),
}));

vi.mock('@/stores/notes/openNotePath', () => ({
  openStoredNotePath: vi.fn(),
}));


vi.mock('@/components/Notes/features/FileTree/components/TreeItemDeleteDialog', () => ({
  TreeItemDeleteDialog: ({ open, itemLabel, onConfirm }: { open: boolean; itemLabel: string; onConfirm: () => void }) =>
    open ? (
      <div>
        <span data-testid="delete-note-label">{itemLabel}</span>
        <button type="button" onClick={onConfirm}>Confirm Delete Note</button>
      </div>
    ) : null,
}));

const notesState = mocks.notesState;
const uiState = mocks.uiState;

describe('NotesView', () => {
  beforeEach(() => {
    mocks.vaultState.currentVault = { path: '/vault' };
    notesState.currentNote = null;
    notesState.openTabs = [];
    notesState.draftNotes = {};
    notesState.isLoading = false;
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [],
      expanded: true,
    };

    notesState.loadFileTree.mockClear();
    notesState.closeTab.mockClear();
    notesState.createNote.mockClear();
    notesState.openNote.mockClear();
    notesState.deleteNote.mockClear();
    notesState.loadStarred.mockClear();
    notesState.loadMetadata.mockClear();
    notesState.loadAssets.mockClear();
    notesState.saveNote.mockClear();
    notesState.cleanupAssetTempFiles.mockClear();
    notesState.clearAssetUrlCache.mockClear();
    notesState.revealFolder.mockClear();
    notesState.setPendingStarredNavigation.mockClear();
    notesState.openNoteByAbsolutePath.mockClear();
    notesState.cancelPendingDraftDiscard.mockClear();
    notesState.confirmPendingDraftDiscard.mockClear();
    notesState.getDisplayName.mockClear();

    uiState.setNotesChatPanelCollapsed.mockClear();
    uiState.toggleNotesChatPanel.mockClear();
    uiState.setLayoutPanelDragging.mockClear();
  });

  it('creates a draft when the workspace is blank', async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledTimes(1);
    });

    expect(notesState.openNote).not.toHaveBeenCalled();
  });

  it('reopens an existing draft instead of creating another one', async () => {
    notesState.draftNotes = {
      'draft:existing': {
        parentPath: null,
        name: '',
      },
    };

    render(<NotesView />);

    await waitFor(() => {
      expect(notesState.openNote).toHaveBeenCalledWith('draft:existing');
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('creates a draft even when no vault is open', async () => {
    mocks.vaultState.currentVault = null;

    render(<NotesView />);

    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledTimes(1);
    });
  });

  it('opens the delete dialog for the current note and confirms deletion', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };

    render(<NotesView />);

    await act(async () => {
      dispatchDeleteCurrentNoteEvent();
    });

    expect(await screen.findByTestId('delete-note-label')).toHaveTextContent('alpha.md');

    fireEvent.click(screen.getByText('Confirm Delete Note'));

    await waitFor(() => {
      expect(notesState.deleteNote).toHaveBeenCalledWith('docs/alpha.md');
    });
  });
});
