import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchDeleteCurrentNoteEvent } from '@/components/Notes/noteDeleteEvents';
import { matchesShortcutBinding } from '@/lib/shortcuts';
import { messageDialog } from '@/lib/storage/dialog';
import { NotesView } from './NotesView';
import { useAbsoluteNoteExternalRenameSync } from './hooks/useAbsoluteNoteExternalRenameSync';
import { useCurrentVaultExternalPathSync } from './hooks/useCurrentVaultExternalPathSync';
import { useNotesExternalSync } from './hooks/useNotesExternalSync';

type MockNotesState = {
  currentNote: { path: string; content: string } | null;
  noteMetadata: { notes: Record<string, Record<string, unknown>> } | null;
  loadFileTree: ReturnType<typeof vi.fn>;
  openTabs: Array<{ path: string; name: string; isDirty: boolean }>;
  recentlyClosedTabs: Array<{
    tab: { path: string; name: string; isDirty: boolean };
    index: number;
  }>;
  closeTab: ReturnType<typeof vi.fn>;
  reopenClosedTab: ReturnType<typeof vi.fn>;
  createNote: ReturnType<typeof vi.fn>;
  openNote: ReturnType<typeof vi.fn>;
  deleteNote: ReturnType<typeof vi.fn>;
  loadStarred: ReturnType<typeof vi.fn>;
  loadMetadata: ReturnType<typeof vi.fn>;
  loadAssets: ReturnType<typeof vi.fn>;
  saveNote: ReturnType<typeof vi.fn>;
  cleanupAssetTempFiles: ReturnType<typeof vi.fn>;
  clearAssetUrlCache: ReturnType<typeof vi.fn>;
  cancelNoteContentScan: ReturnType<typeof vi.fn>;
  revealFolder: ReturnType<typeof vi.fn>;
  isDirty: boolean;
  pendingStarredNavigation: {
    vaultPath: string;
    kind: 'note' | 'folder';
    relativePath: string;
    openInNewTab?: boolean;
    skipWorkspaceRestore?: boolean;
  } | null;
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
  rootFolderPath: string | null;
  draftNotes: Record<string, { parentPath: string | null; name: string }>;
  isLoading: boolean;
  openNoteByAbsolutePath: ReturnType<typeof vi.fn>;
  adoptAbsoluteNoteIntoVault: ReturnType<typeof vi.fn>;
  pendingDraftDiscardPath: string | null;
  cancelPendingDraftDiscard: ReturnType<typeof vi.fn>;
  confirmPendingDraftDiscard: ReturnType<typeof vi.fn>;
  getDisplayName: ReturnType<typeof vi.fn>;
  error: string | null;
};

const mocks = vi.hoisted(() => {
  const notesState: MockNotesState = {
    currentNote: null,
    noteMetadata: null,
    loadFileTree: vi.fn().mockResolvedValue(undefined),
    openTabs: [],
    recentlyClosedTabs: [],
    closeTab: vi.fn(),
    reopenClosedTab: vi.fn().mockResolvedValue(undefined),
    createNote: vi.fn().mockResolvedValue('draft:test'),
    openNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    loadStarred: vi.fn().mockResolvedValue(undefined),
    loadMetadata: vi.fn().mockResolvedValue(undefined),
    loadAssets: vi.fn().mockResolvedValue(undefined),
    saveNote: vi.fn().mockResolvedValue(undefined),
    cleanupAssetTempFiles: vi.fn().mockResolvedValue(undefined),
    clearAssetUrlCache: vi.fn(),
    cancelNoteContentScan: vi.fn(),
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
    rootFolderPath: '/vault',
    draftNotes: {},
    isLoading: false,
    openNoteByAbsolutePath: vi.fn().mockResolvedValue(undefined),
    adoptAbsoluteNoteIntoVault: vi.fn().mockReturnValue(false),
    pendingDraftDiscardPath: null,
    cancelPendingDraftDiscard: vi.fn(),
    confirmPendingDraftDiscard: vi.fn(),
    getDisplayName: vi.fn((path: string) => path.split('/').pop() || path),
    error: null,
  };

  const vaultState = {
    currentVault: { path: '/vault' } as { path: string } | null,
    hasInitialized: true,
    openVault: vi.fn(),
  };

  const uiState = {
    sidebarWidth: 320,
    notesChatPanelCollapsed: true,
    setNotesChatPanelCollapsed: vi.fn(),
    toggleNotesChatPanel: vi.fn(),
    notesChatFloatingOpen: false,
    setNotesChatFloatingOpen: vi.fn(),
    notesChatFloatingSize: { width: 420, height: 680 },
    setNotesChatFloatingSize: vi.fn(),
    resetNotesChatFloatingSize: vi.fn(),
    setLayoutPanelDragging: vi.fn(),
    setAppViewMode: vi.fn(),
    setNotesSidebarView: vi.fn(),
  };

  const storageState = {
    stat: vi.fn(),
  };

  const toastState = {
    addToast: vi.fn(),
  };

  const editorViewRegistry = {
    getCurrentEditorView: vi.fn(),
  };

  const sidebarDiscussion = {
    canOpenSidebarDiscussionForSelection: vi.fn(),
    openSidebarDiscussionForSelection: vi.fn(),
  };

  return {
    notesState,
    vaultState,
    uiState,
    storageState,
    toastState,
    editorViewRegistry,
    sidebarDiscussion,
  };
});

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector: (state: MockNotesState) => unknown) => selector(mocks.notesState),
    {
      getState: () => mocks.notesState,
      setState: (partial: Partial<MockNotesState>) => {
        Object.assign(mocks.notesState, partial);
      },
    },
  ),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: Object.assign(
    (selector?: (state: typeof mocks.vaultState) => unknown) =>
      selector ? selector(mocks.vaultState) : mocks.vaultState,
    {
      getState: () => mocks.vaultState,
    },
  ),
}));

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: Object.assign(
    (selector: (state: { loaded: boolean }) => unknown) => selector({ loaded: true }),
    {
      getState: () => ({ loaded: true }),
    },
  ),
}));

vi.mock('@/stores/uiSlice', () => ({
  NOTES_CHAT_FLOATING_DEFAULT_SIZE: { width: 420, height: 680 },
  NOTES_CHAT_FLOATING_MIN_SIZE: { width: 320, height: 420 },
  NOTES_CHAT_FLOATING_MAX_SIZE: { width: 760, height: 920 },
  useUIStore: (selector: (state: typeof mocks.uiState) => unknown) => selector(mocks.uiState),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: (selector: (state: typeof mocks.toastState) => unknown) => selector(mocks.toastState),
}));

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: {
    setResizable: vi.fn().mockResolvedValue(undefined),
  },
}));

const openMarkdownFileListeners = new Set<(path: string) => void>();

function dispatchDesktopOpenMarkdownFile(path: string) {
  for (const listener of openMarkdownFileListeners) {
    listener(path);
  }
}

vi.mock('@/lib/desktop/shortcuts', () => ({
  onDesktopOpenMarkdownFileShortcut: vi.fn(() => () => {}),
  onDesktopOpenMarkdownFile: vi.fn((callback: (path: string) => void) => {
    openMarkdownFileListeners.add(callback);
    return () => openMarkdownFileListeners.delete(callback);
  }),
}));

vi.mock('@/lib/storage/adapter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/adapter')>('@/lib/storage/adapter');
  return {
    ...actual,
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
  isSupportedMarkdownSelection: vi.fn((path: string) => /\.(?:md|markdown|mdown|mkd)$/i.test(path)),
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
  ResizablePanel: ({
    children,
    className,
    defaultWidth,
    minWidth,
    maxWidth,
    storageKey,
  }: {
    children: ReactNode;
    className?: string;
    defaultWidth?: number;
    minWidth?: number;
    maxWidth?: number;
    storageKey?: string;
  }) => (
    <div
      data-testid="resizable-panel"
      className={className}
      data-default-width={defaultWidth}
      data-min-width={minWidth}
      data-max-width={maxWidth}
      data-storage-key={storageKey}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/Notes/features/FileTree/hooks/externalDragPreview', () => ({
  createExternalDragPreview: () => ({
    updatePaths: vi.fn(),
    updatePosition: vi.fn(),
    dispose: vi.fn(),
  }),
}));

vi.mock('@/components/common/ModuleShortcutsDialog', () => ({
  ModuleShortcutsDialog: () => null,
}));

vi.mock('@/components/Chat/ChatView', () => ({
  ChatView: () => <div data-testid="embedded-chat-view" />,
}));

vi.mock('@/lib/desktop/launchContext', () => ({
  readWindowLaunchContext: vi.fn(() => ({})),
}));

vi.mock('./features/Editor', () => ({
  MarkdownEditor: ({ active }: { active?: boolean }) => {
    const hasRenderableNote = Boolean(mocks.notesState.currentNote?.path);
    return active && hasRenderableNote
      ? <div data-testid="markdown-editor" />
      : <div data-testid="markdown-editor-shell" />;
  },
}));

vi.mock('./features/Editor/preloadMarkdownEditor', () => ({
  preloadMarkdownEditor: vi.fn(async () => ({
    MarkdownEditor: ({ active }: { active?: boolean }) => {
      const hasRenderableNote = Boolean(mocks.notesState.currentNote?.path);
      return active && hasRenderableNote
        ? <div data-testid="markdown-editor" />
        : <div data-testid="markdown-editor-shell" />;
    },
  })),
}));

vi.mock('@/hooks/useModuleShortcutsDialog', () => ({
  useModuleShortcutsDialog: vi.fn(),
}));

vi.mock('@/components/Chat/features/Temporary/temporaryChatCommands', () => ({
  runOpenNewChatShortcut: vi.fn(),
  runTemporaryChatWelcomeShortcut: vi.fn(),
}));

vi.mock('@/components/Notes/features/Editor/utils/editorViewRegistry', () => ({
  getCurrentEditorView: mocks.editorViewRegistry.getCurrentEditorView,
}));

vi.mock('@/components/Notes/features/Editor/plugins/floating-toolbar/ai/sidebarDiscussion', () => ({
  canOpenSidebarDiscussionForSelection: mocks.sidebarDiscussion.canOpenSidebarDiscussionForSelection,
  openSidebarDiscussionForSelection: mocks.sidebarDiscussion.openSidebarDiscussionForSelection,
}));

vi.mock('./hooks/useCurrentVaultExternalPathSync', () => ({
  useCurrentVaultExternalPathSync: vi.fn(),
}));

vi.mock('./hooks/useNotesExternalSync', () => ({
  useNotesExternalSync: vi.fn(),
}));

vi.mock('./hooks/useAbsoluteNoteExternalRenameSync', () => ({
  useAbsoluteNoteExternalRenameSync: vi.fn(),
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

function createDropFile(path: string, exposePath = true) {
  const file = new File([''], path.split('/').pop() || 'dropped-item');
  if (exposePath) {
    Object.defineProperty(file, 'path', {
      value: path,
      configurable: true,
    });
  }
  return file as File & { path: string };
}

function dispatchWindowDragEventWithFiles(
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  files: File[],
  types: string[] = files.length > 0 ? ['Files'] : [],
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      types,
    },
    configurable: true,
  });
  fireEvent(window, event);
}

function dispatchWindowDragEvent(
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  paths: string[] = [],
  types: string[] = paths.length > 0 ? ['Files'] : [],
) {
  dispatchWindowDragEventWithFiles(type, paths.map((path) => createDropFile(path)), types);
}

async function waitForVaultInitializationEffects() {
  await waitFor(() => {
    expect(notesState.loadFileTree).toHaveBeenCalled();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('NotesView', () => {
  beforeEach(() => {
    delete (window as Window & { vlainaDesktop?: unknown }).vlainaDesktop;
    mocks.vaultState.currentVault = { path: '/vault' };
    mocks.vaultState.hasInitialized = true;
    notesState.currentNote = null;
    notesState.noteMetadata = null;
    notesState.openTabs = [];
    notesState.recentlyClosedTabs = [];
    notesState.draftNotes = {};
    notesState.notesPath = '/vault';
    notesState.isLoading = false;
    notesState.pendingStarredNavigation = null;
    notesState.error = null;
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [],
      expanded: true,
    };
    notesState.rootFolderPath = '/vault';
    notesState.openNote.mockImplementation(async (path: string) => {
      notesState.currentNote = { path, content: '' };
    });
    notesState.openNoteByAbsolutePath.mockImplementation(async (path: string) => {
      notesState.currentNote = { path, content: '' };
    });
    notesState.adoptAbsoluteNoteIntoVault.mockReturnValue(false);
    mocks.vaultState.openVault.mockResolvedValue(true);
    mocks.storageState.stat.mockReset();
    shortcutMatchesMock.mockReset();
    shortcutMatchesMock.mockReturnValue(false);

    notesState.loadFileTree.mockClear();
    notesState.closeTab.mockClear();
    notesState.reopenClosedTab.mockClear();
    notesState.createNote.mockClear();
    notesState.openNote.mockClear();
    notesState.deleteNote.mockClear();
    notesState.loadStarred.mockClear();
    notesState.loadMetadata.mockClear();
    notesState.loadAssets.mockClear();
    notesState.saveNote.mockClear();
    notesState.cleanupAssetTempFiles.mockClear();
    notesState.clearAssetUrlCache.mockClear();
    notesState.cancelNoteContentScan.mockClear();
    notesState.revealFolder.mockClear();
    notesState.setPendingStarredNavigation.mockClear();
    notesState.openNoteByAbsolutePath.mockClear();
    notesState.adoptAbsoluteNoteIntoVault.mockClear();
    notesState.cancelPendingDraftDiscard.mockClear();
    notesState.confirmPendingDraftDiscard.mockClear();
    notesState.getDisplayName.mockClear();
    mocks.toastState.addToast.mockClear();
    mocks.editorViewRegistry.getCurrentEditorView.mockReset();
    mocks.sidebarDiscussion.canOpenSidebarDiscussionForSelection.mockReset();
    mocks.sidebarDiscussion.openSidebarDiscussionForSelection.mockReset();
    mocks.vaultState.openVault.mockClear();
    openMarkdownFileListeners.clear();
    vi.mocked(messageDialog).mockReset();
    vi.mocked(useAbsoluteNoteExternalRenameSync).mockClear();
    vi.mocked(useCurrentVaultExternalPathSync).mockClear();
    vi.mocked(useNotesExternalSync).mockClear();

    uiState.setNotesChatPanelCollapsed.mockClear();
    uiState.toggleNotesChatPanel.mockClear();
    uiState.notesChatPanelCollapsed = true;
    uiState.notesChatFloatingOpen = false;
    uiState.setNotesChatFloatingOpen.mockClear();
    uiState.notesChatFloatingSize = { width: 420, height: 680 };
    uiState.setNotesChatFloatingSize.mockClear();
    uiState.resetNotesChatFloatingSize.mockClear();
    uiState.setLayoutPanelDragging.mockClear();
    uiState.setAppViewMode.mockClear();
    uiState.setNotesSidebarView.mockClear();
  });

  it('shows notes store errors as toast messages', async () => {
    notesState.error = 'Save the note before closing it.';

    render(<NotesView />);

    await waitFor(() => {
      expect(mocks.toastState.addToast).toHaveBeenCalledWith(
        'Save the note before closing it.',
        'error',
        4500,
      );
    });
  });

  it('disables external note sync hooks while inactive', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    notesState.openTabs = [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }];

    render(<NotesView active={false} />);
    await waitForVaultInitializationEffects();

    expect(useCurrentVaultExternalPathSync).toHaveBeenCalledWith(null);
    expect(useNotesExternalSync).toHaveBeenCalledWith(null, '');
    expect(useAbsoluteNoteExternalRenameSync).toHaveBeenCalledWith(undefined);
  });

  it('passes inactive state through to the markdown editor', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    notesState.openTabs = [{ path: 'docs/alpha.md', name: 'alpha', isDirty: false }];

    render(<NotesView active={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('markdown-editor')).toBeNull();
    expect(screen.getByTestId('markdown-editor-shell')).toBeInTheDocument();
  });

  it('ignores blank-workspace drops while inactive', async () => {
    mocks.storageState.stat.mockResolvedValue({
      name: 'alpha.md',
      path: '/vault/alpha.md',
      isDirectory: false,
      isFile: true,
    });

    render(<NotesView active={false} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      dispatchWindowDragEvent('dragenter', ['/vault/alpha.md']);
      dispatchWindowDragEvent('drop', ['/vault/alpha.md']);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('blank-workspace-drop-overlay')).toBeNull();
    expect(notesState.openNote).not.toHaveBeenCalled();
    expect(mocks.vaultState.openVault).not.toHaveBeenCalled();
  });

  it('creates a note when the workspace starts blank', async () => {
    render(<NotesView />);

    expect(screen.queryByTestId('markdown-editor')).toBeNull();
    expect(screen.queryByTestId('blank-workspace-drop-overlay')).toBeNull();
    expect(notesState.createNote).not.toHaveBeenCalled();
    expect(notesState.openNote).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledTimes(1);
    });
    expect(notesState.createNote).toHaveBeenCalledWith(undefined, { asDraft: true });
  });

  it('does not create an untitled draft when the opened vault already has files', async () => {
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [
        {
          id: 'docs/alpha.md',
          name: 'alpha.md',
          path: 'docs/alpha.md',
          isFolder: false,
        },
      ],
      expanded: true,
    };

    render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('does not create an untitled draft while opening a populated vault from no vault', async () => {
    mocks.vaultState.currentVault = null;
    notesState.notesPath = '';
    notesState.rootFolder = null;
    notesState.rootFolderPath = null;

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).toHaveBeenCalledWith(undefined, { asDraft: true });
    notesState.createNote.mockClear();

    mocks.vaultState.currentVault = { path: '/vault' };
    notesState.notesPath = '/vault';
    notesState.isLoading = true;
    notesState.rootFolder = null;
    notesState.rootFolderPath = null;
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();

    notesState.isLoading = false;
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [
        {
          id: 'dfds.md',
          name: 'dfds',
          path: 'dfds.md',
          isFolder: false,
        },
      ],
      expanded: true,
    };
    notesState.rootFolderPath = '/vault';
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('does not create an untitled draft from a preserved previous-vault sidebar tree', async () => {
    mocks.vaultState.currentVault = { path: '/vault-next' };
    notesState.notesPath = '/vault-next';
    notesState.rootFolderPath = '/vault-old';
    notesState.rootFolder = {
      id: '',
      name: 'Old notes',
      path: '',
      isFolder: true,
      children: [],
      expanded: true,
    };

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();

    notesState.rootFolderPath = '/vault-next';
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [
        {
          id: 'existing.md',
          name: 'existing',
          path: 'existing.md',
          isFolder: false,
        },
      ],
      expanded: true,
    };
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('does not create an untitled draft while the vault path has not reached the notes store', async () => {
    notesState.notesPath = '';
    mocks.vaultState.currentVault = { path: '/vault' };

    render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
    expect(notesState.notesPath).toBe('');
  });

  it('reveals the pending starred note path before opening it in the workspace', async () => {
    notesState.currentNote = { path: '/external/vault/docs/alpha.md', content: '# alpha' };
    notesState.openTabs = [
      { path: '/external/vault/docs/alpha.md', name: 'alpha', isDirty: false },
    ];
    notesState.pendingStarredNavigation = {
      vaultPath: '/vault',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    };

    const { rerender } = render(<NotesView />);

    await waitFor(() => {
      expect(notesState.setPendingStarredNavigation).toHaveBeenCalledWith(null);
      expect(notesState.revealFolder).toHaveBeenCalledWith('docs/alpha.md');
      expect(notesState.openNote).toHaveBeenCalledWith('docs/alpha.md', false);
    });
    expect(notesState.setPendingStarredNavigation.mock.invocationCallOrder[0]).toBeLessThan(
      notesState.revealFolder.mock.invocationCallOrder[0]
    );
    expect(notesState.revealFolder.mock.invocationCallOrder[0]).toBeLessThan(
      notesState.openNote.mock.invocationCallOrder[0]
    );

    notesState.rootFolder = {
      ...notesState.rootFolder!,
      children: [...notesState.rootFolder!.children],
    };
    rerender(<NotesView />);

    expect(notesState.setPendingStarredNavigation).toHaveBeenCalledTimes(1);
    expect(notesState.revealFolder).toHaveBeenCalledTimes(1);
    expect(notesState.openNote).toHaveBeenCalledTimes(1);
  });

  it('waits for the current vault tree before consuming pending starred navigation', async () => {
    notesState.currentNote = { path: '/external/vault/docs/alpha.md', content: '# alpha' };
    notesState.openTabs = [
      { path: '/external/vault/docs/alpha.md', name: 'alpha', isDirty: false },
    ];
    notesState.pendingStarredNavigation = {
      vaultPath: '/vault',
      kind: 'note',
      relativePath: 'docs/alpha.md',
      skipWorkspaceRestore: true,
    };
    notesState.rootFolderPath = '/old-vault';

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(notesState.setPendingStarredNavigation).not.toHaveBeenCalled();
    expect(notesState.openNote).not.toHaveBeenCalled();

    notesState.rootFolderPath = '/vault';
    notesState.rootFolder = {
      ...notesState.rootFolder!,
      children: [...notesState.rootFolder!.children],
    };
    rerender(<NotesView />);

    await waitFor(() => {
      expect(notesState.setPendingStarredNavigation).toHaveBeenCalledWith(null);
      expect(notesState.openNote).toHaveBeenCalledWith('docs/alpha.md', false);
    });
  });

  it('creates an editable draft when switching from a populated vault to an empty vault', async () => {
    mocks.vaultState.currentVault = { path: '/vault-a' };
    notesState.notesPath = '/vault-a';
    notesState.rootFolderPath = '/vault-a';
    notesState.currentNote = { path: 'alpha.md', content: '# alpha' };
    notesState.openTabs = [{ path: 'alpha.md', name: 'alpha', isDirty: false }];

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await Promise.resolve();
    });

    notesState.createNote.mockClear();
    mocks.vaultState.currentVault = { path: '/vault-b' };
    notesState.notesPath = '/vault-b';
    notesState.currentNote = null;
    notesState.openTabs = [];
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [],
      expanded: true,
    };
    notesState.rootFolderPath = '/vault-b';
    rerender(<NotesView />);

    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledTimes(1);
    });
    expect(notesState.createNote).toHaveBeenCalledWith(undefined, { asDraft: true });
  });

  it('creates a fresh editable note instead of opening an existing draft automatically', async () => {
    notesState.draftNotes = {
      'draft:existing': {
        parentPath: null,
        name: '',
      },
    };

    render(<NotesView />);

    expect(screen.queryByTestId('markdown-editor')).toBeNull();
    expect(notesState.openNote).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledTimes(1);
    });
  });

  it('creates an in-memory scratch draft when the workspace starts blank without an open vault', async () => {
    mocks.vaultState.currentVault = null;
    mocks.vaultState.hasInitialized = true;

    render(<NotesView />);

    expect(screen.queryByTestId('markdown-editor')).toBeNull();

    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledTimes(1);
    });
    expect(notesState.createNote).toHaveBeenCalledWith(undefined, { asDraft: true });
  });

  it('waits for vault store initialization before creating a blank no-vault scratch draft', async () => {
    mocks.vaultState.currentVault = null;
    mocks.vaultState.hasInitialized = false;
    notesState.notesPath = '';
    notesState.rootFolder = null;
    notesState.rootFolderPath = null;

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();

    mocks.vaultState.hasInitialized = true;
    rerender(<NotesView />);

    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledWith(undefined, { asDraft: true });
    });
  });

  it('does not create a transient draft while a previous vault is still hydrating', async () => {
    mocks.vaultState.currentVault = null;
    mocks.vaultState.hasInitialized = false;
    notesState.notesPath = '';
    notesState.rootFolder = null;
    notesState.rootFolderPath = null;

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();

    mocks.vaultState.currentVault = { path: '/vault' };
    mocks.vaultState.hasInitialized = true;
    notesState.notesPath = '/vault';
    notesState.currentNote = { path: 'docs/restored.md', content: '# restored' };
    notesState.openTabs = [{ path: 'docs/restored.md', name: 'restored', isDirty: false }];
    notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [
        {
          id: 'docs/restored.md',
          name: 'restored',
          path: 'docs/restored.md',
          isFolder: false,
        },
      ],
      expanded: true,
    };
    notesState.rootFolderPath = '/vault';
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('does not create an untitled note while the previous workspace note is restoring', async () => {
    notesState.isLoading = true;

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();

    notesState.isLoading = false;
    notesState.currentNote = { path: 'docs/restored.md', content: '# restored' };
    notesState.openTabs = [{ path: 'docs/restored.md', name: 'restored', isDirty: false }];
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('does not create an untitled draft while vault initialization restores over a stale root folder', async () => {
    let resolveLoadFileTree: (() => void) | null = null;
    notesState.loadFileTree.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveLoadFileTree = resolve;
    }));

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();

    notesState.currentNote = { path: 'docs/restored.md', content: '# restored' };
    notesState.openTabs = [{ path: 'docs/restored.md', name: 'restored', isDirty: false }];

    await act(async () => {
      resolveLoadFileTree?.();
      await Promise.resolve();
    });
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('does not recreate a blank note after the user closes the last tab', async () => {
    notesState.currentNote = { path: 'draft:blank', content: '' };
    notesState.openTabs = [{ path: 'draft:blank', name: '', isDirty: false }];
    notesState.draftNotes = {
      'draft:blank': { parentPath: null, name: '' },
    };

    const { rerender } = render(<NotesView />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(notesState.createNote).not.toHaveBeenCalled();

    notesState.currentNote = null;
    notesState.openTabs = [];
    notesState.draftNotes = {};
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(notesState.createNote).not.toHaveBeenCalled();
  });

  it('creates a draft when a blank workspace only has stale recently closed tabs', async () => {
    notesState.currentNote = null;
    notesState.openTabs = [];
    notesState.recentlyClosedTabs = [
      {
        tab: { path: 'alpha.md', name: 'alpha', isDirty: false },
        index: 0,
      },
    ];

    render(<NotesView />);

    await waitFor(() => {
      expect(notesState.createNote).toHaveBeenCalledWith(undefined, { asDraft: true });
    });
  });

  it('does not create an untitled note after an opened workspace becomes empty', async () => {
    notesState.currentNote = { path: 'alpha.md', content: '# alpha' };
    notesState.openTabs = [{ path: 'alpha.md', name: 'alpha', isDirty: false }];

    const { rerender } = render(<NotesView />);

    notesState.createNote.mockClear();
    notesState.currentNote = null;
    notesState.openTabs = [];
    rerender(<NotesView />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

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

    await act(async () => {
      dispatchWindowDragEvent('dragenter', ['/dropped-vault']);
    });

    expect(screen.getByTestId('blank-workspace-drop-overlay')).toBeInTheDocument();

    await act(async () => {
      dispatchWindowDragEvent('drop', ['/dropped-vault']);
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

    await act(async () => {
      dispatchWindowDragEvent('drop', ['/vault/alpha.md']);
    });

    await waitFor(() => {
      expect(notesState.openNote).toHaveBeenCalledWith('alpha.md');
    });
  });

  it('opens a dropped .markdown file when the workspace is blank', async () => {
    mocks.storageState.stat.mockResolvedValue({
      name: 'alpha.markdown',
      path: '/vault/alpha.markdown',
      isDirectory: false,
      isFile: true,
    });

    render(<NotesView />);

    await act(async () => {
      dispatchWindowDragEvent('drop', ['/vault/alpha.markdown']);
    });

    await waitFor(() => {
      expect(notesState.openNote).toHaveBeenCalledWith('alpha.markdown');
    });
  });

  it('rejects a dropped folder when authorization returns a relative path', async () => {
    mocks.storageState.stat.mockResolvedValue({
      name: 'docs',
      path: 'relative/docs',
      isDirectory: true,
      isFile: false,
    });

    render(<NotesView />);

    await act(async () => {
      dispatchWindowDragEvent('drop', ['/tmp/docs']);
    });

    await waitFor(() => {
      expect(messageDialog).toHaveBeenCalled();
    });
    expect(mocks.vaultState.openVault).not.toHaveBeenCalled();
  });

  it('opens a markdown file from the Electron file association event', async () => {
    const authorizePath = vi.fn().mockResolvedValue({
      name: 'alpha.md',
      path: '/vault/alpha.md',
      isDirectory: false,
      isFile: true,
    });
    (window as any).vlainaDesktop = {
      platform: 'electron',
      dragDrop: { authorizePath },
    };

    render(<NotesView />);

    await act(async () => {
      dispatchDesktopOpenMarkdownFile('/vault/alpha.md');
    });

    await waitFor(() => {
      expect(authorizePath).toHaveBeenCalledWith('/vault/alpha.md');
      expect(notesState.openNote).toHaveBeenCalledWith('alpha.md');
    });
    expect(notesState.openNoteByAbsolutePath).not.toHaveBeenCalledWith('/vault/alpha.md');
  });

  it('opens a dropped markdown file after opening its vault from a new workspace', async () => {
    mocks.vaultState.currentVault = null;
    notesState.notesPath = '';
    notesState.rootFolder = null;
    notesState.rootFolderPath = null;
    mocks.storageState.stat.mockResolvedValue({
      name: 'alpha.md',
      path: '/vault/alpha.md',
      isDirectory: false,
      isFile: true,
    });
    mocks.vaultState.openVault.mockImplementation(async (path: string) => {
      mocks.vaultState.currentVault = { path };
      notesState.notesPath = path;
      return true;
    });

    const { rerender } = render(<NotesView />);

    await act(async () => {
      dispatchWindowDragEvent('drop', ['/vault/alpha.md']);
    });

    await waitFor(() => {
      expect(mocks.vaultState.openVault).toHaveBeenCalledWith('/vault', undefined, {
        preserveSidebarTree: false,
      });
    });

    rerender(<NotesView />);

    await waitFor(() => {
      expect(notesState.openNote).toHaveBeenCalledWith('alpha.md');
      expect(notesState.loadFileTree).toHaveBeenCalledWith(true);
    });
  });

  it('accepts a blank-workspace file drag before Electron exposes file paths', async () => {
    mocks.storageState.stat.mockResolvedValue({
      name: 'alpha.md',
      path: '/vault/alpha.md',
      isDirectory: false,
      isFile: true,
    });

    render(<NotesView />);

    await act(async () => {
      dispatchWindowDragEvent('dragenter', [], ['Files']);
    });

    expect(screen.getByTestId('blank-workspace-drop-overlay')).toBeInTheDocument();

    await act(async () => {
      dispatchWindowDragEvent('drop', ['/vault/alpha.md']);
    });

    await waitFor(() => {
      expect(notesState.openNote).toHaveBeenCalledWith('alpha.md');
    });
  });

  it('opens a dropped markdown file through Electron file path resolution', async () => {
    const getPathForFile = vi.fn((file: File) => `/vault/${file.name}`);
    const authorizePath = vi.fn(async (path: string) => ({
      name: 'alpha.md',
      path,
      isDirectory: false,
      isFile: true,
    }));
    (window as any).vlainaDesktop = {
      platform: 'electron',
      dragDrop: { getPathForFile, authorizePath },
    };
    mocks.storageState.stat.mockResolvedValue({
      name: 'alpha.md',
      path: '/vault/alpha.md',
      isDirectory: false,
      isFile: true,
    });

    render(<NotesView />);

    const file = createDropFile('/vault/alpha.md', false);
    await act(async () => {
      dispatchWindowDragEventWithFiles('drop', [file]);
    });

    await waitFor(() => {
      expect(getPathForFile).toHaveBeenCalledWith(file);
      expect(authorizePath).toHaveBeenCalledWith('/vault/alpha.md');
      expect(notesState.openNote).toHaveBeenCalledWith('alpha.md');
    });
  });

  it('opens the authorized path for dropped markdown files when Electron normalizes it', async () => {
    const getPathForFile = vi.fn(() => '/tmp/link.md');
    const authorizePath = vi.fn(async () => ({
      name: 'canonical.md',
      path: '/vault/canonical.md',
      isDirectory: false,
      isFile: true,
    }));
    (window as any).vlainaDesktop = {
      platform: 'electron',
      dragDrop: { getPathForFile, authorizePath },
    };

    render(<NotesView />);

    const file = createDropFile('/tmp/link.md', false);
    await act(async () => {
      dispatchWindowDragEventWithFiles('drop', [file]);
    });

    await waitFor(() => {
      expect(getPathForFile).toHaveBeenCalledWith(file);
      expect(authorizePath).toHaveBeenCalledWith('/tmp/link.md');
      expect(notesState.openNote).toHaveBeenCalledWith('canonical.md');
      expect(notesState.openNote).not.toHaveBeenCalledWith('link.md');
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

  it('quotes the current editor selection to chat on Ctrl+L', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    const editorView = {
      state: {
        selection: {
          empty: false,
        },
      },
    };
    mocks.editorViewRegistry.getCurrentEditorView.mockReturnValue(editorView);
    mocks.sidebarDiscussion.canOpenSidebarDiscussionForSelection.mockReturnValue(true);
    shortcutMatchesMock.mockImplementation((event, binding) => (
      binding === 'toggleEmbeddedChat' && event.key.toLowerCase() === 'l' && event.ctrlKey
    ));

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(mocks.sidebarDiscussion.openSidebarDiscussionForSelection).toHaveBeenCalledWith(editorView);
    expect(uiState.toggleNotesChatPanel).not.toHaveBeenCalled();
  });

  it('opens the floating notes chat on Ctrl+L when there is no editor selection', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    mocks.editorViewRegistry.getCurrentEditorView.mockReturnValue({
      state: {
        selection: {
          empty: true,
        },
      },
    });
    shortcutMatchesMock.mockImplementation((event, binding) => (
      binding === 'toggleEmbeddedChat' && event.key.toLowerCase() === 'l' && event.ctrlKey
    ));

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(uiState.setNotesChatPanelCollapsed).toHaveBeenCalledWith(true);
    expect(uiState.setNotesChatFloatingOpen).toHaveBeenCalledWith(true);
    expect(uiState.toggleNotesChatPanel).not.toHaveBeenCalled();
    expect(mocks.sidebarDiscussion.openSidebarDiscussionForSelection).not.toHaveBeenCalled();
  });

  it('quotes the current block selection to chat on Ctrl+L', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    const editorView = {
      state: {
        selection: {
          empty: true,
        },
      },
    };
    mocks.editorViewRegistry.getCurrentEditorView.mockReturnValue(editorView);
    mocks.sidebarDiscussion.canOpenSidebarDiscussionForSelection.mockReturnValue(true);
    shortcutMatchesMock.mockImplementation((event, binding) => (
      binding === 'toggleEmbeddedChat' && event.key.toLowerCase() === 'l' && event.ctrlKey
    ));

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(mocks.sidebarDiscussion.openSidebarDiscussionForSelection).toHaveBeenCalledWith(editorView);
    expect(uiState.toggleNotesChatPanel).not.toHaveBeenCalled();
  });

  it('uses the saved size for the floating notes chat panel', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    uiState.notesChatFloatingOpen = true;
    uiState.notesChatFloatingSize = { width: 512, height: 720 };

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const panel = document.querySelector('[data-notes-chat-floating="true"]') as HTMLElement;
    expect(panel).toBeInTheDocument();
    expect(panel.style.width).toBe('512px');
    expect(panel.style.height).toBe('720px');
    expect(document.querySelector('[data-notes-chat-floating-resize-handle="left"]')).toBeInTheDocument();
    expect(document.querySelector('[data-notes-chat-floating-resize-handle="top"]')).toBeInTheDocument();
    expect(document.querySelector('[data-notes-chat-floating-resize-handle="top-left"]')).toBeInTheDocument();
  });

  it('opens the notes chat side panel as a docked resizable panel', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    uiState.notesChatPanelCollapsed = false;
    uiState.notesChatFloatingOpen = false;

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const resizablePanel = screen.getByTestId('resizable-panel');
    expect(resizablePanel).toHaveAttribute('data-storage-key', 'vlaina_notes_chat_panel_width_v2');
    expect(resizablePanel).toHaveAttribute('data-default-width', '320');
    expect(document.querySelector('[data-notes-chat-panel="true"]')).toBeInTheDocument();
    expect(document.querySelector('[data-notes-chat-floating="true"]')).toBeNull();
  });

  it('resizes floating notes chat from the left, top, and top-left handles', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    uiState.notesChatFloatingOpen = true;
    uiState.notesChatFloatingSize = { width: 420, height: 680 };

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const leftHandle = document.querySelector('[data-notes-chat-floating-resize-handle="left"]') as HTMLElement;
    fireEvent.pointerDown(leftHandle, { clientX: 600, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 540, clientY: 300 });
    fireEvent.pointerUp(window);

    expect(uiState.setLayoutPanelDragging).toHaveBeenCalledWith(true);
    expect(uiState.setNotesChatFloatingSize).toHaveBeenCalledWith({ width: 480, height: 680 });
    expect(uiState.setLayoutPanelDragging).toHaveBeenLastCalledWith(false);

    uiState.setNotesChatFloatingSize.mockClear();
    uiState.setLayoutPanelDragging.mockClear();

    const topHandle = document.querySelector('[data-notes-chat-floating-resize-handle="top"]') as HTMLElement;
    fireEvent.pointerDown(topHandle, { clientX: 500, clientY: 600 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 560 });
    fireEvent.pointerUp(window);

    expect(uiState.setLayoutPanelDragging).toHaveBeenCalledWith(true);
    expect(uiState.setNotesChatFloatingSize).toHaveBeenCalledWith({ width: 420, height: 720 });
    expect(uiState.setLayoutPanelDragging).toHaveBeenLastCalledWith(false);

    uiState.setNotesChatFloatingSize.mockClear();
    uiState.setLayoutPanelDragging.mockClear();

    const topLeftHandle = document.querySelector('[data-notes-chat-floating-resize-handle="top-left"]') as HTMLElement;
    fireEvent.pointerDown(topLeftHandle, { clientX: 600, clientY: 600 });
    fireEvent.pointerMove(window, { clientX: 570, clientY: 570 });
    fireEvent.pointerUp(window);

    expect(uiState.setLayoutPanelDragging).toHaveBeenCalledWith(true);
    expect(uiState.setNotesChatFloatingSize).toHaveBeenCalledWith({ width: 450, height: 710 });
    expect(uiState.setLayoutPanelDragging).toHaveBeenLastCalledWith(false);
  });

  it('resets floating notes chat size when double-clicking resize handles', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    uiState.notesChatFloatingOpen = true;

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    fireEvent.doubleClick(document.querySelector('[data-notes-chat-floating-resize-handle="left"]') as HTMLElement);
    fireEvent.doubleClick(document.querySelector('[data-notes-chat-floating-resize-handle="top"]') as HTMLElement);
    fireEvent.doubleClick(document.querySelector('[data-notes-chat-floating-resize-handle="top-left"]') as HTMLElement);

    expect(uiState.resetNotesChatFloatingSize).toHaveBeenCalledTimes(3);
  });

  it('closes the open side chat panel on Ctrl+L', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    uiState.notesChatPanelCollapsed = false;
    const editorView = {
      state: {
        selection: {
          empty: false,
        },
      },
    };
    mocks.editorViewRegistry.getCurrentEditorView.mockReturnValue(editorView);
    shortcutMatchesMock.mockImplementation((event, binding) => (
      binding === 'toggleEmbeddedChat' && event.key.toLowerCase() === 'l' && event.ctrlKey
    ));

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(uiState.setNotesChatPanelCollapsed).toHaveBeenCalledWith(true);
    expect(uiState.setNotesChatFloatingOpen).not.toHaveBeenCalled();
    expect(uiState.toggleNotesChatPanel).not.toHaveBeenCalled();
    expect(mocks.sidebarDiscussion.openSidebarDiscussionForSelection).not.toHaveBeenCalled();
  });

  it('closes the floating notes chat on Ctrl+L when it is already open', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    uiState.notesChatPanelCollapsed = true;
    uiState.notesChatFloatingOpen = true;
    mocks.editorViewRegistry.getCurrentEditorView.mockReturnValue({
      state: {
        selection: {
          empty: false,
        },
      },
    });
    shortcutMatchesMock.mockImplementation((event, binding) => (
      binding === 'toggleEmbeddedChat' && event.key.toLowerCase() === 'l' && event.ctrlKey
    ));

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(uiState.setNotesChatFloatingOpen).toHaveBeenCalledWith(false);
    expect(uiState.setNotesChatPanelCollapsed).not.toHaveBeenCalled();
    expect(uiState.toggleNotesChatPanel).not.toHaveBeenCalled();
    expect(mocks.sidebarDiscussion.openSidebarDiscussionForSelection).not.toHaveBeenCalled();
  });

  it('does not cycle notes on Ctrl+Tab from inside a dialog', async () => {
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
    await waitForVaultInitializationEffects();
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

  it('does not let notes shortcuts steal editable copy', async () => {
    notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
    shortcutMatchesMock.mockImplementation((event, binding) => (
      binding === 'toggleEmbeddedChat' && event.key.toLowerCase() === 'c' && event.ctrlKey
    ));

    render(<NotesView />);
    await waitForVaultInitializationEffects();

    const editor = document.createElement('div');
    editor.className = 'ProseMirror';
    editor.setAttribute('contenteditable', 'true');
    document.body.appendChild(editor);

    try {
      const event = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(uiState.toggleNotesChatPanel).not.toHaveBeenCalled();
      expect(mocks.sidebarDiscussion.openSidebarDiscussionForSelection).not.toHaveBeenCalled();
    } finally {
      editor.remove();
    }
  });

  it('reopens the last closed tab on Ctrl+Alt+T', async () => {
    notesState.currentNote = { path: 'docs/current.md', content: '# current' };
    shortcutMatchesMock.mockImplementation((event, binding) => (
      binding === 'reopenClosedTab' && event.key.toLowerCase() === 't' && event.ctrlKey && event.altKey
    ));

    render(<NotesView />);

    fireEvent.keyDown(document, { key: 'T', ctrlKey: true, altKey: true });

    await waitFor(() => {
      expect(notesState.reopenClosedTab).toHaveBeenCalledTimes(1);
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
