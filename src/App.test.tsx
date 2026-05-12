import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

type NotesState = {
  openTabs: Array<{ path: string; isDirty?: boolean }>;
  draftNotes: Record<string, { name: string; parentPath?: string | null; originNotesPath?: string }>;
  noteContentsCache: Map<string, { content: string }>;
  noteMetadata: { notes: Record<string, unknown> } | null;
  currentNote: { path: string; content?: string } | null;
  notesPath: string;
  isDirty: boolean;
  openNote: ReturnType<typeof vi.fn>;
  openNoteByAbsolutePath: ReturnType<typeof vi.fn>;
  saveNote: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const notesState: NotesState = {
    openTabs: [],
    draftNotes: {},
    noteContentsCache: new Map(),
    noteMetadata: null,
    currentNote: null,
    notesPath: '',
    isDirty: false,
    openNote: vi.fn().mockResolvedValue(undefined),
    openNoteByAbsolutePath: vi.fn().mockResolvedValue(undefined),
    saveNote: vi.fn().mockResolvedValue(undefined),
  };

  return {
    notesState,
    closeRequestedHandler: null as null | (() => void),
    desktopWindow: {
      setResizable: vi.fn().mockResolvedValue(undefined),
      setMaximizable: vi.fn().mockResolvedValue(undefined),
      setMinSize: vi.fn().mockResolvedValue(undefined),
      getSize: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
      setSize: vi.fn().mockResolvedValue(undefined),
      center: vi.fn().mockResolvedValue(undefined),
      confirmClose: vi.fn().mockResolvedValue(undefined),
      onCloseRequested: vi.fn((callback: () => void) => {
        mocks.closeRequestedHandler = callback;
        return vi.fn();
      }),
    },
    flushPendingSave: vi.fn().mockResolvedValue(undefined),
    flushPendingSessionJsonSaves: vi.fn().mockResolvedValue(undefined),
    flushCurrentPendingEditorMarkdown: vi.fn(() => false),
    openStoredNotePath: vi.fn().mockResolvedValue(undefined),
    addToast: vi.fn(),
    checkStatus: vi.fn().mockResolvedValue(undefined),
    refreshBudget: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: mocks.desktopWindow,
}));

vi.mock('@/lib/electron/bridge', () => ({
  isElectronRuntime: () => true,
  getElectronBridge: () => ({
    account: {
      onAuthLog: vi.fn(() => vi.fn()),
    },
  }),
}));

vi.mock('@/lib/storage/unifiedStorage', () => ({
  flushPendingSave: mocks.flushPendingSave,
}));

vi.mock('@/lib/storage/chatStorage', () => ({
  flushPendingSessionJsonSaves: mocks.flushPendingSessionJsonSaves,
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: {
    getState: () => mocks.notesState,
  },
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: () => ({
    currentVault: null,
    initialize: vi.fn(),
  }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: () => ({
    appViewMode: 'chat',
    sidebarCollapsed: false,
    sidebarWidth: 320,
    notesChatPanelCollapsed: true,
    setSidebarWidth: vi.fn(),
    toggleSidebar: vi.fn(),
    setAppViewMode: vi.fn(),
  }),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mocks.addToast }),
  },
}));

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: {
    getState: () => ({ checkStatus: mocks.checkStatus }),
  },
}));

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: {
    getState: () => ({ refreshBudget: mocks.refreshBudget }),
  },
}));

vi.mock('@/stores/useAIStore', () => ({
  useAIStoreRuntimeEffects: vi.fn(),
}));

vi.mock('@/hooks/useShortcuts', () => ({
  useShortcuts: vi.fn(),
}));

vi.mock('@/hooks/useSyncInit', () => ({
  useSyncInit: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedExternalSync', () => ({
  useUnifiedExternalSync: vi.fn(),
}));

vi.mock('@/components/Chat/features/Temporary/useTemporaryTogglePresentation', () => ({
  useTemporaryTogglePresentation: () => ({ showInTitleBar: false }),
}));

vi.mock('@/stores/notes/draftNote', () => ({
  isDraftNotePath: (path?: string | null) => typeof path === 'string' && path.startsWith('draft:'),
  canAutoSaveDraftNote: (notesPath: string, draftNote?: { originNotesPath?: string }) => Boolean(
    notesPath &&
    draftNote &&
    (draftNote.originNotesPath === undefined || draftNote.originNotesPath === notesPath)
  ),
  hasDraftUnsavedChanges: ({ draftName, content }: { draftName?: string; content?: string }) =>
    Boolean((draftName ?? '').trim() || (content ?? '').trim()),
}));

vi.mock('@/stores/notes/pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: mocks.flushCurrentPendingEditorMarkdown,
}));

vi.mock('@/stores/notes/openNotePath', () => ({
  openStoredNotePath: (...args: unknown[]) => mocks.openStoredNotePath(...args),
}));

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/common/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/Settings', () => ({
  SettingsModal: () => null,
}));

vi.mock('@/components/ui/Toast', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

vi.mock('@/components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onClose,
    onConfirm,
    onCancelAction,
    title,
    confirmText,
    cancelText,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onCancelAction: () => void;
    title: string;
    confirmText: string;
    cancelText: string;
  }) => isOpen ? (
    <div>
      <span>{title}</span>
      <button onClick={onConfirm}>{confirmText}</button>
      <button onClick={onCancelAction}>{cancelText}</button>
      <button onClick={onClose}>Close</button>
    </div>
  ) : null,
}));

vi.mock('@/components/layout/shell/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/SidebarUserHeader', () => ({
  SidebarUserHeader: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: () => null,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  PointerSensor: function PointerSensor() {},
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
  iconButtonStyles: '',
}));

describe('App close flow', () => {
  beforeEach(() => {
    mocks.notesState.openTabs = [];
    mocks.notesState.draftNotes = {};
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.noteMetadata = null;
    mocks.notesState.currentNote = null;
    mocks.notesState.notesPath = '';
    mocks.notesState.isDirty = false;
    mocks.notesState.openNote.mockClear();
    mocks.notesState.openNoteByAbsolutePath.mockClear();
    mocks.notesState.saveNote.mockClear();
    mocks.flushCurrentPendingEditorMarkdown.mockClear();
    mocks.flushCurrentPendingEditorMarkdown.mockImplementation(() => false);
    mocks.openStoredNotePath.mockReset();
    mocks.openStoredNotePath.mockImplementation(async (path: string) => {
      const tab = mocks.notesState.openTabs.find((item) => item.path === path);
      mocks.notesState.currentNote = {
        path,
        content: mocks.notesState.noteContentsCache.get(path)?.content ?? '',
      };
      mocks.notesState.isDirty = Boolean(tab?.isDirty);
    });
    mocks.desktopWindow.setResizable.mockClear();
    mocks.desktopWindow.setMaximizable.mockClear();
    mocks.desktopWindow.setMinSize.mockClear();
    mocks.desktopWindow.getSize.mockClear();
    mocks.desktopWindow.setSize.mockClear();
    mocks.desktopWindow.center.mockClear();
    mocks.desktopWindow.confirmClose.mockClear();
    mocks.desktopWindow.onCloseRequested.mockClear();
    mocks.flushPendingSave.mockClear();
    mocks.flushPendingSessionJsonSaves.mockClear();
    mocks.flushCurrentPendingEditorMarkdown.mockClear();
    mocks.flushCurrentPendingEditorMarkdown.mockImplementation(() => false);
    mocks.closeRequestedHandler = null;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  async function renderAndRequestClose() {
    render(<App />);
    await waitFor(() => {
      expect(mocks.desktopWindow.onCloseRequested).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      mocks.closeRequestedHandler?.();
      await Promise.resolve();
    });
  }

  it('flushes pending storage before closing when nothing is dirty', async () => {
    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.flushPendingSave).toHaveBeenCalledTimes(1);
      expect(mocks.flushPendingSessionJsonSaves).toHaveBeenCalledTimes(1);
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('Unsaved Drafts')).toBeNull();
  });

  it('does not close a clean window when pending storage fails to flush', async () => {
    mocks.flushPendingSave.mockRejectedValueOnce(new Error('disk unavailable'));

    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.flushPendingSave).toHaveBeenCalledTimes(1);
    });
    expect(mocks.desktopWindow.confirmClose).not.toHaveBeenCalled();
  });

  it('recovers clean-close state after confirmClose rejects', async () => {
    mocks.desktopWindow.confirmClose.mockRejectedValueOnce(new Error('window denied close'));

    render(<App />);
    await waitFor(() => {
      expect(mocks.desktopWindow.onCloseRequested).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      mocks.closeRequestedHandler?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      mocks.closeRequestedHandler?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(2);
    });
  });

  it('flushes pending writes before closing when a non-draft note is dirty', async () => {
    mocks.notesState.currentNote = { path: 'docs/a.md' };
    mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: true }];
    mocks.notesState.isDirty = true;
    mocks.notesState.saveNote.mockImplementation(async () => {
      mocks.notesState.isDirty = false;
      mocks.notesState.openTabs = mocks.notesState.openTabs.map((tab) =>
        tab.path === 'docs/a.md' ? { ...tab, isDirty: false } : tab
      );
    });

    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.flushPendingSave).toHaveBeenCalledTimes(1);
      expect(mocks.flushPendingSessionJsonSaves).toHaveBeenCalledTimes(1);
      expect(mocks.notesState.saveNote).toHaveBeenCalledTimes(1);
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });
  });

  it('flushes pending editor markdown before deciding whether the window is clean', async () => {
    let didFlushEditor = false;
    mocks.notesState.currentNote = { path: 'docs/a.md', content: '# old' };
    mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: false }];
    mocks.notesState.noteContentsCache = new Map([['docs/a.md', { content: '# old' }]]);
    mocks.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      if (didFlushEditor) return false;
      didFlushEditor = true;
      mocks.notesState.currentNote = { path: 'docs/a.md', content: '# pending' };
      mocks.notesState.isDirty = true;
      mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: true }];
      mocks.notesState.noteContentsCache = new Map([['docs/a.md', { content: '# pending' }]]);
      return true;
    });
    mocks.notesState.saveNote.mockImplementation(async () => {
      mocks.notesState.isDirty = false;
      mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: false }];
    });

    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.flushCurrentPendingEditorMarkdown).toHaveBeenCalled();
      expect(mocks.notesState.saveNote).toHaveBeenCalledTimes(1);
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });
  });

  it('flushes auto-saveable drafts when the app is hidden', async () => {
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.currentNote = { path: 'draft:alpha', content: 'draft body' };
    mocks.notesState.isDirty = true;
    mocks.notesState.openTabs = [{ path: 'draft:alpha', isDirty: true }];
    mocks.notesState.draftNotes = { 'draft:alpha': { parentPath: null, name: 'Alpha' } };
    mocks.notesState.saveNote.mockImplementation(async () => {
      delete mocks.notesState.draftNotes['draft:alpha'];
      mocks.notesState.currentNote = { path: 'Alpha.md', content: 'draft body' };
      mocks.notesState.isDirty = false;
      mocks.notesState.openTabs = [{ path: 'Alpha.md', isDirty: false }];
    });
    render(<App />);
    await waitFor(() => expect(mocks.desktopWindow.onCloseRequested).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => expect(mocks.notesState.saveNote).toHaveBeenCalledWith({ suppressOpenTarget: true }));
  });

  it('flushes pending editor markdown when the app is hidden before checking dirty notes', async () => {
    let didFlushEditor = false;
    mocks.notesState.currentNote = { path: 'docs/a.md', content: '# old' };
    mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: false }];
    mocks.notesState.noteContentsCache = new Map([['docs/a.md', { content: '# old' }]]);
    mocks.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      if (didFlushEditor) return false;
      didFlushEditor = true;
      mocks.notesState.currentNote = { path: 'docs/a.md', content: '# pending' };
      mocks.notesState.isDirty = true;
      mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: true }];
      mocks.notesState.noteContentsCache = new Map([['docs/a.md', { content: '# pending' }]]);
      return true;
    });
    mocks.notesState.saveNote.mockImplementation(async () => {
      mocks.notesState.isDirty = false;
      mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: false }];
    });
    render(<App />);
    await waitFor(() => expect(mocks.desktopWindow.onCloseRequested).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => {
      expect(mocks.flushCurrentPendingEditorMarkdown).toHaveBeenCalled();
      expect(mocks.notesState.saveNote).toHaveBeenCalledTimes(1);
    });
  });

  it('flushes dirty regular background tabs before closing', async () => {
    mocks.notesState.currentNote = { path: 'docs/b.md', content: '# B' };
    mocks.notesState.openTabs = [
      { path: 'docs/a.md', isDirty: true },
      { path: 'docs/b.md', isDirty: false },
    ];
    mocks.notesState.noteContentsCache = new Map([
      ['docs/a.md', { content: 'Unsaved A' }],
      ['docs/b.md', { content: '# B' }],
    ]);
    mocks.notesState.saveNote.mockImplementation(async () => {
      const path = mocks.notesState.currentNote?.path;
      mocks.notesState.isDirty = false;
      mocks.notesState.openTabs = mocks.notesState.openTabs.map((tab) =>
        tab.path === path ? { ...tab, isDirty: false } : tab
      );
    });

    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.openStoredNotePath).toHaveBeenCalledWith(
        'docs/a.md',
        expect.objectContaining({
          openNote: mocks.notesState.openNote,
          openNoteByAbsolutePath: mocks.notesState.openNoteByAbsolutePath,
        })
      );
      expect(mocks.notesState.saveNote).toHaveBeenCalledTimes(1);
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });
  });

  it('saves auto-saveable drafts before closing without showing the discard dialog', async () => {
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.currentNote = { path: 'draft:alpha', content: 'unsaved content' };
    mocks.notesState.openTabs = [{ path: 'draft:alpha', isDirty: true }];
    mocks.notesState.isDirty = true;
    mocks.notesState.draftNotes = { 'draft:alpha': { parentPath: null, name: 'Draft Alpha' } };
    mocks.notesState.noteContentsCache = new Map([['draft:alpha', { content: 'unsaved content' }]]);
    mocks.notesState.saveNote.mockImplementation(async () => {
      delete mocks.notesState.draftNotes['draft:alpha'];
      mocks.notesState.currentNote = { path: 'Draft Alpha.md', content: 'unsaved content' };
      mocks.notesState.isDirty = false;
      mocks.notesState.openTabs = [{ path: 'Draft Alpha.md', isDirty: false }];
    });

    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.flushCurrentPendingEditorMarkdown).toHaveBeenCalled();
      expect(mocks.notesState.saveNote).toHaveBeenCalledWith({ suppressOpenTarget: true });
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Unsaved Drafts')).toBeNull();
  });

  it('saves cached auto-saveable drafts before the clean-window fast close path', async () => {
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.currentNote = { path: 'docs/a.md', content: 'clean note' };
    mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: false }];
    mocks.notesState.isDirty = false;
    mocks.notesState.draftNotes = { 'draft:cached': { parentPath: null, name: 'Cached Draft' } };
    mocks.notesState.noteContentsCache = new Map([['draft:cached', { content: 'cached draft body' }]]);
    mocks.notesState.openNote.mockImplementation(async (path: string) => {
      mocks.notesState.currentNote = {
        path,
        content: mocks.notesState.noteContentsCache.get(path)?.content ?? '',
      };
      mocks.notesState.isDirty = Boolean(mocks.notesState.openTabs.find((tab) => tab.path === path)?.isDirty);
    });
    mocks.notesState.saveNote.mockImplementation(async () => {
      delete mocks.notesState.draftNotes['draft:cached'];
      mocks.notesState.currentNote = { path: 'Cached Draft.md', content: 'cached draft body' };
      mocks.notesState.isDirty = false;
      mocks.notesState.openTabs = [
        { path: 'docs/a.md', isDirty: false },
        { path: 'Cached Draft.md', isDirty: false },
      ];
    });

    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.notesState.openNote).toHaveBeenCalledWith('draft:cached');
      expect(mocks.notesState.saveNote).toHaveBeenCalledWith({ suppressOpenTarget: true });
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });
  });

  it('blocks closing when an auto-saveable draft fails to save', async () => {
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.currentNote = { path: 'draft:alpha', content: 'unsaved content' };
    mocks.notesState.openTabs = [{ path: 'draft:alpha', isDirty: true }];
    mocks.notesState.isDirty = true;
    mocks.notesState.draftNotes = { 'draft:alpha': { parentPath: null, name: 'Draft Alpha' } };
    mocks.notesState.noteContentsCache = new Map([['draft:alpha', { content: 'unsaved content' }]]);
    mocks.notesState.saveNote.mockResolvedValue(undefined);

    await renderAndRequestClose();

    await waitFor(() => {
      expect(mocks.notesState.saveNote).toHaveBeenCalledTimes(1);
    });
    expect(mocks.desktopWindow.confirmClose).not.toHaveBeenCalled();
    expect(screen.queryByText('Unsaved Drafts')).toBeNull();
  });

  it('opens the unsaved draft confirm dialog before closing draft notes', async () => {
    mocks.notesState.currentNote = { path: 'draft:alpha' };
    mocks.notesState.openTabs = [{ path: 'draft:alpha' }];
    mocks.notesState.draftNotes = {
      'draft:alpha': { name: 'Draft Alpha' },
    };
    mocks.notesState.noteContentsCache = new Map([
      ['draft:alpha', { content: 'unsaved content' }],
    ]);

    await renderAndRequestClose();

    expect(await screen.findByText('Unsaved Drafts')).toBeInTheDocument();
    expect(mocks.desktopWindow.confirmClose).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('Discard and Close'));
    });

    await waitFor(() => {
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });
  });

  it('closes the unsaved draft dialog immediately when discarding drafts before close', async () => {
    mocks.notesState.currentNote = { path: 'draft:alpha' };
    mocks.notesState.openTabs = [{ path: 'draft:alpha' }];
    mocks.notesState.draftNotes = {
      'draft:alpha': { name: 'Draft Alpha' },
    };
    mocks.notesState.noteContentsCache = new Map([
      ['draft:alpha', { content: 'unsaved content' }],
    ]);
    mocks.flushPendingSave.mockImplementationOnce(() => new Promise(() => {}));

    await renderAndRequestClose();

    expect(await screen.findByText('Unsaved Drafts')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Discard and Close'));
      await Promise.resolve();
    });

    expect(screen.queryByText('Unsaved Drafts')).toBeNull();
  });

  it('discards current draft and still flushes dirty regular background tabs before closing', async () => {
    mocks.notesState.currentNote = { path: 'draft:alpha', content: 'draft body' };
    mocks.notesState.openTabs = [
      { path: 'draft:alpha', isDirty: true },
      { path: 'docs/a.md', isDirty: true },
    ];
    mocks.notesState.isDirty = true;
    mocks.notesState.draftNotes = {
      'draft:alpha': { name: 'Draft Alpha' },
    };
    mocks.notesState.noteContentsCache = new Map([
      ['draft:alpha', { content: 'draft body' }],
      ['docs/a.md', { content: 'regular body' }],
    ]);
    mocks.notesState.saveNote.mockImplementation(async () => {
      const path = mocks.notesState.currentNote?.path;
      mocks.notesState.openTabs = mocks.notesState.openTabs.map((tab) =>
        tab.path === path ? { ...tab, isDirty: false } : tab
      );
      mocks.notesState.isDirty = Boolean(
        mocks.notesState.openTabs.find((tab) => tab.path === mocks.notesState.currentNote?.path)?.isDirty
      );
    });

    await renderAndRequestClose();

    expect(await screen.findByText('Unsaved Drafts')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Discard and Close'));
    });

    await waitFor(() => {
      expect(mocks.openStoredNotePath).toHaveBeenCalledWith(
        'docs/a.md',
        expect.objectContaining({
          openNote: mocks.notesState.openNote,
          openNoteByAbsolutePath: mocks.notesState.openNoteByAbsolutePath,
        })
      );
      expect(mocks.notesState.saveNote).toHaveBeenCalledTimes(1);
      expect(mocks.desktopWindow.confirmClose).toHaveBeenCalledTimes(1);
    });
  });

  it('opens the unsaved draft confirm dialog for a current draft missing from tabs', async () => {
    mocks.notesState.currentNote = { path: 'draft:orphan', content: 'current draft body' };
    mocks.notesState.openTabs = [];
    mocks.notesState.draftNotes = {
      'draft:orphan': { name: '' },
    };

    await renderAndRequestClose();

    expect(await screen.findByText('Unsaved Drafts')).toBeInTheDocument();
    expect(mocks.desktopWindow.confirmClose).not.toHaveBeenCalled();
  });

  it('opens the unsaved draft confirm dialog for a cached draft missing from tabs', async () => {
    mocks.notesState.currentNote = { path: 'docs/a.md' };
    mocks.notesState.openTabs = [{ path: 'docs/a.md', isDirty: false }];
    mocks.notesState.draftNotes = {
      'draft:cached': { name: '' },
    };
    mocks.notesState.noteContentsCache = new Map([
      ['draft:cached', { content: 'cached draft body' }],
    ]);

    await renderAndRequestClose();

    expect(await screen.findByText('Unsaved Drafts')).toBeInTheDocument();
    expect(mocks.desktopWindow.confirmClose).not.toHaveBeenCalled();
  });
});
