import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importExternalMarkdownEntries } from './externalMarkdownImport';
import { useNotesSidebarExternalDropImport } from './useNotesSidebarExternalDropImport';

const mocks = vi.hoisted(() => ({
  notesState: {
    notesPath: '/notesRoot',
    starredEntries: [],
  },
  importExternalMarkdownEntries: vi.fn(),
  resolveExternalMarkdownEntriesForStarred: vi.fn(),
  messageDialog: vi.fn(),
  saveStarredRegistry: vi.fn(),
  clearExternalFileTreeDropTarget: vi.fn(),
  setExternalFileTreeDropTarget: vi.fn(),
}));

vi.mock('@/lib/storage/dialog', () => ({
  messageDialog: mocks.messageDialog,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector: (state: typeof mocks.notesState) => unknown) => selector(mocks.notesState),
    {
      getState: () => mocks.notesState,
      setState: (partial: Partial<typeof mocks.notesState>) => {
        Object.assign(mocks.notesState, partial);
      },
    },
  ),
}));

vi.mock('@/stores/notes/starred', () => ({
  createStarredEntryIfValid: vi.fn((kind: string, notesRootPath: string, relativePath: string) => ({
    kind,
    notesRootPath,
    relativePath,
  })),
  getStarredEntryKey: vi.fn((entry: { kind: string; notesRootPath: string; relativePath: string }) =>
    `${entry.kind}:${entry.notesRootPath}:${entry.relativePath}`
  ),
  getNotesRootStarredPaths: vi.fn(() => ({ notes: [], folders: [] })),
  saveStarredRegistry: mocks.saveStarredRegistry,
}));

vi.mock('../features/FileTree/hooks/externalFileTreeDropState', () => ({
  clearExternalFileTreeDropTarget: mocks.clearExternalFileTreeDropTarget,
  setExternalFileTreeDropTarget: mocks.setExternalFileTreeDropTarget,
}));

vi.mock('../features/FileTree/hooks/externalDragPreview', () => ({
  createExternalDragPreview: vi.fn(() => ({
    updatePaths: vi.fn(),
    updatePosition: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('./externalMarkdownImport', () => ({
  importExternalMarkdownEntries: mocks.importExternalMarkdownEntries,
  resolveExternalMarkdownEntriesForStarred: mocks.resolveExternalMarkdownEntriesForStarred,
}));

function createDropFile(path: string) {
  const file = new File([''], path.split('/').pop() || 'dropped-item');
  Object.defineProperty(file, 'path', {
    value: path,
    configurable: true,
  });
  return file;
}

function createDropEvent(files: File[], types: string[] = []) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      types,
    },
    configurable: true,
  });
  return event;
}

function createFileDragEvent(
  type: 'dragenter' | 'dragleave',
  files: File[],
  relatedTarget: EventTarget | null = null,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    dataTransfer: {
      value: { files, types: ['Files'] },
      configurable: true,
    },
    clientX: {
      value: 24,
      configurable: true,
    },
    clientY: {
      value: 24,
      configurable: true,
    },
    relatedTarget: {
      value: relatedTarget,
      configurable: true,
    },
  });
  return event;
}

describe('useNotesSidebarExternalDropImport', () => {
  const originalElementsFromPoint = document.elementsFromPoint;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notesState.notesPath = '/notesRoot';
    mocks.notesState.starredEntries = [];
    mocks.importExternalMarkdownEntries.mockResolvedValue({
      importedNotePaths: ['alpha.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    mocks.resolveExternalMarkdownEntriesForStarred.mockResolvedValue([]);
  });

  afterEach(() => {
    document.elementsFromPoint = originalElementsFromPoint;
    document.body.replaceChildren();
  });

  it('imports file-list drops even when drag types do not expose Files', async () => {
    const sidebar = document.createElement('div');
    sidebar.dataset.notesSidebarScrollRoot = 'true';
    const rootTarget = document.createElement('div');
    rootTarget.dataset.fileTreeRootDropTarget = 'true';
    sidebar.appendChild(rootTarget);
    document.body.appendChild(sidebar);
    document.elementsFromPoint = vi.fn(() => [rootTarget]);

    const loadFileTree = vi.fn(async () => undefined);
    const revealFolder = vi.fn();
    renderHook(() => useNotesSidebarExternalDropImport({
      enabled: true,
      notesRootPath: '/notesRoot',
      loadFileTree,
      revealFolder,
    }));

    await act(async () => {
      window.dispatchEvent(createDropEvent([createDropFile('/outside/alpha.md')]));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importExternalMarkdownEntries).toHaveBeenCalledWith('/notesRoot', '', ['/outside/alpha.md']);
    });
    expect(loadFileTree).toHaveBeenCalledWith(true);
    expect(revealFolder).toHaveBeenCalledWith('');
    expect(mocks.messageDialog).not.toHaveBeenCalled();
  });

  it('keeps the external drop target active while crossing sidebar descendants', () => {
    const sidebar = document.createElement('div');
    sidebar.dataset.notesSidebarScrollRoot = 'true';
    const firstRow = document.createElement('div');
    const secondRow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sidebar.append(firstRow, secondRow);
    document.body.appendChild(sidebar);
    document.elementsFromPoint = vi.fn(() => [firstRow]);

    renderHook(() => useNotesSidebarExternalDropImport({
      enabled: true,
      notesRootPath: '/notesRoot',
      loadFileTree: vi.fn(async () => undefined),
      revealFolder: vi.fn(),
    }));

    act(() => {
      window.dispatchEvent(createFileDragEvent(
        'dragenter',
        [createDropFile('/outside/alpha.md')],
      ));
    });
    expect(mocks.setExternalFileTreeDropTarget).toHaveBeenCalled();
    mocks.clearExternalFileTreeDropTarget.mockClear();

    act(() => {
      window.dispatchEvent(createFileDragEvent(
        'dragleave',
        [createDropFile('/outside/alpha.md')],
        secondRow,
      ));
    });

    expect(mocks.clearExternalFileTreeDropTarget).not.toHaveBeenCalled();
  });

  it('clears external drag feedback when the drop finishes outside the sidebar', () => {
    const sidebar = document.createElement('div');
    sidebar.dataset.notesSidebarScrollRoot = 'true';
    const sidebarRow = document.createElement('div');
    sidebar.appendChild(sidebarRow);
    const outside = document.createElement('div');
    document.body.append(sidebar, outside);
    document.elementsFromPoint = vi.fn(() => [sidebarRow]);

    renderHook(() => useNotesSidebarExternalDropImport({
      enabled: true,
      notesRootPath: '/notesRoot',
      loadFileTree: vi.fn(async () => undefined),
      revealFolder: vi.fn(),
    }));

    const files = [createDropFile('/outside/alpha.md')];
    act(() => {
      window.dispatchEvent(createFileDragEvent('dragenter', files));
    });
    mocks.clearExternalFileTreeDropTarget.mockClear();
    document.elementsFromPoint = vi.fn(() => [outside]);

    act(() => {
      window.dispatchEvent(createDropEvent(files));
    });

    expect(mocks.clearExternalFileTreeDropTarget).toHaveBeenCalledTimes(1);
  });

  it('stars an external Markdown file without importing it into the opened folder', async () => {
    const sidebar = document.createElement('div');
    sidebar.dataset.notesSidebarScrollRoot = 'true';
    const starredTarget = document.createElement('div');
    starredTarget.dataset.fileTreeStarredDropTarget = 'true';
    sidebar.appendChild(starredTarget);
    document.body.appendChild(sidebar);
    document.elementsFromPoint = vi.fn(() => [starredTarget]);
    mocks.resolveExternalMarkdownEntriesForStarred.mockResolvedValueOnce([{
      kind: 'note',
      notesRootPath: '/outside',
      relativePath: 'alpha.md',
    }]);

    renderHook(() => useNotesSidebarExternalDropImport({
      enabled: true,
      notesRootPath: '/notesRoot',
      loadFileTree: vi.fn(async () => undefined),
      revealFolder: vi.fn(),
    }));

    await act(async () => {
      window.dispatchEvent(createDropEvent([createDropFile('/outside/alpha.md')]));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.resolveExternalMarkdownEntriesForStarred).toHaveBeenCalledWith(
        '/notesRoot',
        ['/outside/alpha.md'],
      );
      expect(mocks.saveStarredRegistry).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: 'note',
          notesRootPath: '/outside',
          relativePath: 'alpha.md',
        }),
      ]);
    });
    expect(mocks.importExternalMarkdownEntries).not.toHaveBeenCalled();
    expect(mocks.messageDialog).not.toHaveBeenCalled();
  });

  it('shows unsupported feedback when a starred drop contains no Markdown entries', async () => {
    const sidebar = document.createElement('div');
    sidebar.dataset.notesSidebarScrollRoot = 'true';
    const starredTarget = document.createElement('div');
    starredTarget.dataset.fileTreeStarredDropTarget = 'true';
    sidebar.appendChild(starredTarget);
    document.body.appendChild(sidebar);
    document.elementsFromPoint = vi.fn(() => [starredTarget]);

    renderHook(() => useNotesSidebarExternalDropImport({
      enabled: true,
      notesRootPath: '/notesRoot',
      loadFileTree: vi.fn(async () => undefined),
      revealFolder: vi.fn(),
    }));

    await act(async () => {
      window.dispatchEvent(createDropEvent([createDropFile('/outside/image.png')]));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.messageDialog).toHaveBeenCalledWith(
        'notes.onlyMarkdownCanBeStarred',
        {
          title: 'notes.unsupportedDrop',
          kind: 'warning',
        },
      );
    });
    expect(mocks.importExternalMarkdownEntries).not.toHaveBeenCalled();
    expect(mocks.saveStarredRegistry).not.toHaveBeenCalled();
  });

  it('isolates rejected external drop imports', async () => {
    const sidebar = document.createElement('div');
    sidebar.dataset.notesSidebarScrollRoot = 'true';
    const rootTarget = document.createElement('div');
    rootTarget.dataset.fileTreeRootDropTarget = 'true';
    sidebar.appendChild(rootTarget);
    document.body.appendChild(sidebar);
    document.elementsFromPoint = vi.fn(() => [rootTarget]);
    mocks.importExternalMarkdownEntries.mockRejectedValueOnce(new Error('copy failed'));

    const loadFileTree = vi.fn(async () => undefined);
    const revealFolder = vi.fn();
    renderHook(() => useNotesSidebarExternalDropImport({
      enabled: true,
      notesRootPath: '/notesRoot',
      loadFileTree,
      revealFolder,
    }));

    await act(async () => {
      window.dispatchEvent(createDropEvent([createDropFile('/outside/alpha.md')]));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importExternalMarkdownEntries).toHaveBeenCalledWith('/notesRoot', '', ['/outside/alpha.md']);
    });
    expect(loadFileTree).not.toHaveBeenCalled();
    expect(revealFolder).not.toHaveBeenCalled();
  });
});
