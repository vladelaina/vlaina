import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from './MarkdownEditor';

type MockNotesState = {
  currentNote: { path: string; content: string } | null;
  currentNoteRevision: number;
  currentNoteDiskRevision: number;
  noteContentsCache: Map<string, { content: string; modifiedAt?: number | null }>;
  displayNames: Map<string, string>;
  openTabs: Array<{ path: string; name: string; isDirty: boolean }>;
  draftNotes: Record<string, { parentPath: string | null; name: string }>;
  noteMetadata: { notes: Record<string, Record<string, unknown>> } | null;
  notesPath: string;
  starredEntries: Array<{
    id: string;
    kind: 'note' | 'folder';
    vaultPath: string;
    relativePath: string;
    addedAt: number;
  }>;
  isStarred: (path: string) => boolean;
  toggleStarred: ReturnType<typeof vi.fn>;
  saveNote: ReturnType<typeof vi.fn>;
  getDisplayName: (path: string) => string;
  updateContent: (content: string) => void;
  isDirty: boolean;
};

const mocks = vi.hoisted(() => {
  const notesStoreListeners = new Set<() => void>();
  const notifyNotesStoreListeners = () => {
    for (const listener of notesStoreListeners) {
      listener();
    }
  };

  const notesState: MockNotesState = {
    currentNote: { path: 'alpha.md', content: '# Alpha\n\nInitial body' },
    currentNoteRevision: 0,
    currentNoteDiskRevision: 0,
    noteContentsCache: new Map(),
    displayNames: new Map([['alpha.md', 'alpha.md']]),
    openTabs: [{ path: 'alpha.md', name: 'alpha.md', isDirty: false }],
    draftNotes: {},
    noteMetadata: null,
    notesPath: '/vault',
    starredEntries: [],
    isStarred: () => false,
    toggleStarred: vi.fn(),
    saveNote: vi.fn().mockResolvedValue(undefined),
    getDisplayName: (path: string) => path,
    updateContent: (content: string) => {
      if (notesState.currentNote) {
        notesState.currentNote = { ...notesState.currentNote, content };
      }
      notesState.isDirty = true;
    },
    isDirty: false,
  };

  return {
    notesStoreListeners,
    notifyNotesStoreListeners,
    notesState,
    milkdownRuntimeMode: {
      value: 'throw' as 'throw' | 'never-ready' | 'live-dom-never-ready',
    },
  };
});

vi.mock('@/stores/useNotesStore', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const subscribe = (listener: () => void) => {
    mocks.notesStoreListeners.add(listener);
    return () => {
      mocks.notesStoreListeners.delete(listener);
    };
  };

  return {
    useNotesStore: Object.assign(
      (selector: (state: MockNotesState) => unknown) => React.useSyncExternalStore(
        subscribe,
        () => selector(mocks.notesState),
        () => selector(mocks.notesState),
      ),
      {
        getState: () => mocks.notesState,
        subscribe,
        setState: (updater: Partial<MockNotesState> | ((state: MockNotesState) => Partial<MockNotesState>)) => {
          const patch = typeof updater === 'function' ? updater(mocks.notesState) : updater;
          Object.assign(mocks.notesState, patch);
          mocks.notifyNotesStoreListeners();
        },
      },
    ),
  };
});

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: (selector: (state: { data: { settings: { markdown: { body: { showLineNumbers: boolean } } } } }) => unknown) =>
    selector({ data: { settings: { markdown: { body: { showLineNumbers: false } } } } }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: Object.assign(
    (selector: (state: { notesPreviewTitle: null; universalPreviewTarget: null; universalPreviewIcon: undefined }) => unknown) =>
      selector({
        notesPreviewTitle: null,
        universalPreviewTarget: null,
        universalPreviewIcon: undefined,
      }),
    {
      getState: () => ({
        notesPreviewTitle: null,
        universalPreviewTarget: null,
        universalPreviewIcon: undefined,
      }),
      subscribe: () => () => {},
    },
  ),
}));

vi.mock('@/components/ui/overlay-scroll-area', async () => {
  const React = await import('react');
  return {
    OverlayScrollArea: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({
        children,
        viewportClassName: _viewportClassName,
        draggingBodyClassName: _draggingBodyClassName,
        scrollbarVariant: _scrollbarVariant,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        viewportClassName?: string;
        draggingBodyClassName?: string;
        scrollbarVariant?: string;
      }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      ),
    ),
  };
});

vi.mock('./EditorTopRightToolbar', () => ({
  EditorTopRightToolbar: ({
    currentNotePath,
    starred,
    toggleStarred,
  }: {
    currentNotePath?: string | null;
    starred: boolean;
    toggleStarred: (path: string) => void;
  }) => (
    <button
      type="button"
      aria-label={starred ? 'Unfavorite' : 'Add to Starred'}
      onClick={() => {
        if (currentNotePath) {
          toggleStarred(currentNotePath);
        }
      }}
    >
      {starred ? 'Unfavorite' : 'Add to Starred'}
    </button>
  ),
}));

vi.mock('./NoteHeader', () => ({
  NoteHeader: () => null,
}));

vi.mock('../Cover', () => ({
  CoverAddOverlay: () => null,
  NoteCoverCanvas: () => null,
  useNoteCoverController: () => ({
    cover: {
      url: null,
      positionX: 50,
      positionY: 50,
      height: undefined,
      scale: 1,
    },
    isPickerOpen: false,
    openCoverPicker: vi.fn(),
  }),
}));

vi.mock('@/hooks/useHeldPageScroll', () => ({
  useHeldPageScroll: vi.fn(),
}));

vi.mock('../Sidebar/sidebarSearchNavigation', () => ({
  getSidebarSearchNavigationPendingPath: () => null,
  isSidebarSearchNavigationPending: () => false,
  subscribeSidebarSearchNavigationPending: () => () => {},
}));

vi.mock('./find/useNoteEditorFind', () => ({
  useNoteEditorFind: () => ({
    query: '',
    setQuery: vi.fn(),
    isOpen: false,
    setOpen: vi.fn(),
    close: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    matchIndex: 0,
    matchCount: 0,
  }),
}));

vi.mock('./MilkdownEditorInner', () => ({
  MilkdownEditorRuntime: () => {
    if (mocks.milkdownRuntimeMode.value === 'throw') {
      throw new Error('Milkdown failed to create');
    }

    if (mocks.milkdownRuntimeMode.value === 'live-dom-never-ready') {
      return (
        <div className="milkdown">
          <div className="ProseMirror" data-testid="milkdown-live-dom" />
        </div>
      );
    }

    return <div data-testid="milkdown-never-ready" />;
  },
}));

describe('MarkdownEditor source fallback', () => {
  beforeEach(() => {
    mocks.notesState.currentNote = { path: 'alpha.md', content: '# Alpha\n\nInitial body' };
    mocks.notesState.currentNoteRevision = 0;
    mocks.notesState.currentNoteDiskRevision = 0;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.displayNames = new Map([['alpha.md', 'alpha.md']]);
    mocks.notesState.openTabs = [{ path: 'alpha.md', name: 'alpha.md', isDirty: false }];
    mocks.notesState.draftNotes = {};
    mocks.notesState.noteMetadata = null;
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.starredEntries = [];
    mocks.notesState.isDirty = false;
    mocks.notesState.toggleStarred.mockClear();
    mocks.notesState.saveNote.mockClear();
    mocks.milkdownRuntimeMode.value = 'throw';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps markdown editable when the Milkdown runtime throws during render', async () => {
    render(<MarkdownEditor />);

    const sourceEditor = await screen.findByLabelText('Markdown source editor');
    expect(sourceEditor).toHaveValue('# Alpha\n\nInitial body');

    fireEvent.change(sourceEditor, { target: { value: '# Alpha\n\nEdited body' } });

    expect(mocks.notesState.currentNote?.content).toBe('# Alpha\n\nEdited body');
    expect(mocks.notesState.isDirty).toBe(true);

    fireEvent.blur(sourceEditor);
    await waitFor(() => {
      expect(mocks.notesState.saveNote).toHaveBeenCalledWith({ explicit: false });
    });
  });

  it('keeps markdown editable when the Milkdown runtime mounts but never becomes ready', async () => {
    vi.useFakeTimers();
    mocks.milkdownRuntimeMode.value = 'never-ready';

    render(<MarkdownEditor />);

    await act(async () => {});
    expect(screen.getByTestId('milkdown-never-ready')).toBeInstanceOf(HTMLElement);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    const sourceEditor = screen.getByLabelText('Markdown source editor');
    expect(sourceEditor).toHaveValue('# Alpha\n\nInitial body');
  });

  it('does not switch to source fallback when a live ProseMirror editor is present', async () => {
    vi.useFakeTimers();
    mocks.milkdownRuntimeMode.value = 'live-dom-never-ready';

    render(<MarkdownEditor />);

    await act(async () => {});
    expect(screen.getByTestId('milkdown-live-dom')).toBeInstanceOf(HTMLElement);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.queryByLabelText('Markdown source editor')).toBeNull();
    expect(screen.getByTestId('milkdown-live-dom')).toBeInstanceOf(HTMLElement);
  });

  it('refreshes the toolbar starred state when the starred registry changes', async () => {
    render(<MarkdownEditor />);

    expect(await screen.findByRole('button', { name: 'Add to Starred' })).toBeInTheDocument();

    act(() => {
      mocks.notesState.starredEntries = [{
        id: 'starred-alpha',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'alpha.md',
        addedAt: 1,
      }];
      mocks.notifyNotesStoreListeners();
    });

    expect(screen.getByRole('button', { name: 'Unfavorite' })).toBeInTheDocument();

    act(() => {
      mocks.notesState.starredEntries = [];
      mocks.notifyNotesStoreListeners();
    });

    expect(screen.getByRole('button', { name: 'Add to Starred' })).toBeInTheDocument();
  });

  it('cancels pending fallback autosaves when switching notes', async () => {
    vi.useFakeTimers();

    const { rerender } = render(<MarkdownEditor />);

    await act(async () => {});
    const sourceEditor = screen.getByLabelText('Markdown source editor');
    fireEvent.change(sourceEditor, { target: { value: '# Alpha\n\nEdited body' } });

    mocks.notesState.currentNote = { path: 'beta.md', content: '# Beta\n\nInitial body' };
    mocks.notesState.openTabs = [{ path: 'beta.md', name: 'beta.md', isDirty: false }];
    rerender(<MarkdownEditor />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mocks.notesState.saveNote).not.toHaveBeenCalled();
  });

  it('does not flush composing fallback pinyin when the source editor unmounts before compositionend', async () => {
    const { unmount } = render(<MarkdownEditor />);

    const sourceEditor = await screen.findByLabelText('Markdown source editor');
    fireEvent.compositionStart(sourceEditor);
    fireEvent.change(sourceEditor, { target: { value: '# Alpha\n\nnihao' } });

    expect(mocks.notesState.currentNote?.content).toBe('# Alpha\n\nInitial body');

    unmount();

    expect(mocks.notesState.currentNote?.content).toBe('# Alpha\n\nInitial body');
    expect(mocks.notesState.isDirty).toBe(false);
  });

  it('commits fallback Chinese text after compositionend', async () => {
    render(<MarkdownEditor />);

    const sourceEditor = await screen.findByLabelText('Markdown source editor');
    fireEvent.compositionStart(sourceEditor);
    fireEvent.change(sourceEditor, { target: { value: '# Alpha\n\nnihao' } });

    expect(mocks.notesState.currentNote?.content).toBe('# Alpha\n\nInitial body');

    fireEvent.compositionEnd(sourceEditor, { target: { value: '# Alpha\n\n你好' } });

    expect(mocks.notesState.currentNote?.content).toBe('# Alpha\n\n你好');
    expect(mocks.notesState.isDirty).toBe(true);
  });
});
