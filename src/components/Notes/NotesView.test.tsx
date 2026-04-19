import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchDeleteCurrentNoteEvent } from '@/components/Notes/noteDeleteEvents';
import { matchesShortcutBinding } from '@/lib/shortcuts';
import { NotesView } from './NotesView';

type MockNotesState = {
  currentNote: { path: string; content: string } | null;
  noteMetadata: { notes: Record<string, Record<string, unknown>> } | null;
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
  adoptAbsoluteNoteIntoVault: ReturnType<typeof vi.fn>;
  pendingDraftDiscardPath: string | null;
  cancelPendingDraftDiscard: ReturnType<typeof vi.fn>;
  confirmPendingDraftDiscard: ReturnType<typeof vi.fn>;
  getDisplayName: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const notesState: MockNotesState = {
    currentNote: null,
    noteMetadata: null,
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
    adoptAbsoluteNoteIntoVault: vi.fn().mockReturnValue(false),
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

  const windowState = {
    dropHandler: null as ((event: { payload: { type: string; paths?: string[] } }) => void) | null,
    onDragDropEvent: vi.fn(async (handler: (event: { payload: { type: string; paths?: string[] } }) => void) => {
      windowState.dropHandler = handler;
      return vi.fn();
    }),
  };

  const storageState = {
    stat: vi.fn(),
  };

  return {
    notesState,
    vaultState,
    uiState,
    windowState,
    storageState,
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

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: mocks.windowState.onDragDropEvent,
  }),
}));

vi.mock('@/lib/storage/adapter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/adapter')>('@/lib/storage/adapter');
  return {
    ...actual,
    isTauri: vi.fn(() => true),
    getStorageAdapter: () => ({
      stat: mocks.storageState.stat,
    }),
  };
});

vi.mock('@/lib/storage/dialog', () => ({
  openDialog: vi.fn(),
  messageDialog: vi.fn(),
}));

vi.mock('@/lib/notes/openMarkdownFileText', () => ({
  OPEN_MARKDOWN_FILE_ACTION: 'Open Markdown File',
}));

vi.mock('./features/OpenTarget/openTargetSelection', () => ({
  getSingleOpenSelection: vi.fn(),
  isSupportedMarkdownSelection: vi.fn((path: string) => path.toLowerCase().endsWith('.md')),
  resolveOpenNoteTarget: vi.fn((path: string) => ({
    vaultPath: '/vault',
    notePath: path.split('/').pop() || path,
  })),
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
const shortcutMatchesMock = vi.mocked(matchesShortcutBinding);

describe('NotesView', () => {
  beforeEach(() => {
    mocks.vaultState.currentVault = { path: '/vault' };
    notesState.currentNote = null;
    notesState.noteMetadata = null;
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
    notesState.openNote.mockImplementation(async (path: string) => {
      notesState.currentNote = { path, content: '' };
    });
    notesState.openNoteByAbsolutePath.mockImplementation(async (path: string) => {
      notesState.currentNote = { path, content: '' };
    });
    notesState.adoptAbsoluteNoteIntoVault.mockReturnValue(false);
    mocks.vaultState.openVault.mockResolvedValue(true);
    mocks.windowState.dropHandler = null;
    mocks.storageState.stat.mockReset();
    shortcutMatchesMock.mockReset();
    shortcutMatchesMock.mockReturnValue(false);

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
    notesState.adoptAbsoluteNoteIntoVault.mockClear();
    notesState.cancelPendingDraftDiscard.mockClear();
    notesState.confirmPendingDraftDiscard.mockClear();
    notesState.getDisplayName.mockClear();
    mocks.vaultState.openVault.mockClear();
    mocks.windowState.onDragDropEvent.mockClear();

    uiState.setNotesChatPanelCollapsed.mockClear();
    uiState.toggleNotesChatPanel.mockClear();
    uiState.setLayoutPanelDragging.mockClear();
  });

  it('does not register blank-workspace drag handlers while inactive', async () => {
    render(<NotesView active={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.windowState.onDragDropEvent).not.toHaveBeenCalled();
    expect(mocks.windowState.dropHandler).toBeNull();
  });

  it('keeps the workspace blank when nothing is open', async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(mocks.windowState.onDragDropEvent).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('markdown-editor')).toBeNull();
    expect(screen.queryByTestId('blank-workspace-drop-overlay')).toBeNull();
    expect(notesState.createNote).not.toHaveBeenCalled();
    expect(notesState.openNote).not.toHaveBeenCalled();
  });

  it('does not auto-open an existing draft when the workspace is blank', async () => {
    notesState.draftNotes = {
      'draft:existing': {
        parentPath: null,
        name: '',
      },
    };

    render(<NotesView />);

    await waitFor(() => {
      expect(mocks.windowState.onDragDropEvent).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('markdown-editor')).toBeNull();
    expect(notesState.createNote).not.toHaveBeenCalled();
    expect(notesState.openNote).not.toHaveBeenCalled();
  });

  it('keeps the workspace blank even when no vault is open', async () => {
    mocks.vaultState.currentVault = null;

    render(<NotesView />);

    await waitFor(() => {
      expect(mocks.windowState.onDragDropEvent).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('markdown-editor')).toBeNull();
    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('opens a dropped folder when the workspace is blank', async () => {
    mocks.storageState.stat.mockResolvedValue({
      name: 'dropped-vault',
      path: '/dropped-vault',
      isDirectory: true,
      isFile: false,
    });

    render(<NotesView />);

    await waitFor(() => {
      expect(mocks.windowState.onDragDropEvent).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      mocks.windowState.dropHandler?.({
        payload: {
          type: 'enter',
          paths: ['/dropped-vault'],
        },
      });
    });

    expect(screen.getByTestId('blank-workspace-drop-overlay')).toBeInTheDocument();

    await act(async () => {
      mocks.windowState.dropHandler?.({
        payload: {
          type: 'drop',
          paths: ['/dropped-vault'],
        },
      });
    });

    await waitFor(() => {
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/dropped-vault');
    });

    await waitFor(() => {
      expect(screen.queryByTestId('blank-workspace-drop-overlay')).toBeNull();
    });
  });

  it('opens a dropped markdown file when the workspace is blank', async () => {
    mocks.storageState.stat.mockResolvedValue({
      name: 'alpha.md',
      path: '/vault/alpha.md',
      isDirectory: false,
      isFile: true,
    });

    render(<NotesView />);

    await waitFor(() => {
      expect(mocks.windowState.onDragDropEvent).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      mocks.windowState.dropHandler?.({
        payload: {
          type: 'drop',
          paths: ['/vault/alpha.md'],
        },
      });
    });

    await waitFor(() => {
      expect(notesState.openNote).toHaveBeenCalledWith('alpha.md');
    });
  });


  it('cycles to the next note in tree order when only one note tab is open', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    notesState.openTabs = [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }];
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'docs',
          name: 'docs',
          path: 'docs',
          isFolder: true,
          expanded: true,
          children: [
            { id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false },
            { id: 'docs/beta.md', name: 'beta', path: 'docs/beta.md', isFolder: false },
          ],
        },
      ],
    };
    shortcutMatchesMock.mockImplementation((event, binding) => binding === 'nextNoteTab' && event.key === 'Tab' && event.ctrlKey && !event.shiftKey);

    render(<NotesView />);

    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true });

    await waitFor(() => {
      expect(notesState.revealFolder).toHaveBeenCalledWith('docs/beta.md');
      expect(notesState.openNote).toHaveBeenCalledWith('docs/beta.md');
    });
  });

  it('cycles to the previous note in tree order when only one note tab is open', async () => {
    notesState.currentNote = { path: 'docs/beta.md', content: '# beta' };
    notesState.openTabs = [{ path: 'docs/beta.md', name: 'beta', isDirty: false }];
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'docs',
          name: 'docs',
          path: 'docs',
          isFolder: true,
          expanded: true,
          children: [
            { id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false },
            { id: 'docs/beta.md', name: 'beta', path: 'docs/beta.md', isFolder: false },
          ],
        },
      ],
    };
    shortcutMatchesMock.mockImplementation((event, binding) => binding === 'previousNoteTab' && event.key === 'Tab' && event.ctrlKey && event.shiftKey);

    render(<NotesView />);

    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true, shiftKey: true });

    await waitFor(() => {
      expect(notesState.revealFolder).toHaveBeenCalledWith('docs/alpha.md');
      expect(notesState.openNote).toHaveBeenCalledWith('docs/alpha.md');
    });
  });

  it('does not cycle notes on Ctrl+Tab from inside a dialog', () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    notesState.openTabs = [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }];
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'docs',
          name: 'docs',
          path: 'docs',
          isFolder: true,
          expanded: true,
          children: [
            { id: 'docs/alpha.md', name: 'alpha', path: 'docs/alpha.md', isFolder: false },
            { id: 'docs/beta.md', name: 'beta', path: 'docs/beta.md', isFolder: false },
          ],
        },
      ],
    };
    shortcutMatchesMock.mockImplementation((event, binding) => binding === 'nextNoteTab' && event.key === 'Tab' && event.ctrlKey && !event.shiftKey);

    render(<NotesView />);
    notesState.openNote.mockClear();
    notesState.revealFolder.mockClear();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(notesState.revealFolder).not.toHaveBeenCalled();
    expect(notesState.openNote).not.toHaveBeenCalled();
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
