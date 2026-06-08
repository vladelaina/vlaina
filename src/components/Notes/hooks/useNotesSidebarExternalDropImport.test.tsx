import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importExternalMarkdownEntries } from './externalMarkdownImport';
import { useNotesSidebarExternalDropImport } from './useNotesSidebarExternalDropImport';

const mocks = vi.hoisted(() => ({
  notesState: {
    notesPath: '/vault',
    starredEntries: [],
  },
  importExternalMarkdownEntries: vi.fn(),
  resolveExternalMarkdownEntriesForStarred: vi.fn(),
  messageDialog: vi.fn(),
  saveStarredRegistry: vi.fn(),
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
  createStarredEntryIfValid: vi.fn((kind: string, vaultPath: string, relativePath: string) => ({
    kind,
    vaultPath,
    relativePath,
  })),
  getStarredEntryKey: vi.fn((entry: { kind: string; vaultPath: string; relativePath: string }) =>
    `${entry.kind}:${entry.vaultPath}:${entry.relativePath}`
  ),
  getVaultStarredPaths: vi.fn(() => ({ notes: [], folders: [] })),
  saveStarredRegistry: mocks.saveStarredRegistry,
}));

vi.mock('../features/FileTree/hooks/externalFileTreeDropState', () => ({
  clearExternalFileTreeDropTarget: vi.fn(),
  setExternalFileTreeDropTarget: vi.fn(),
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

describe('useNotesSidebarExternalDropImport', () => {
  const originalElementsFromPoint = document.elementsFromPoint;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notesState.notesPath = '/vault';
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
      vaultPath: '/vault',
      loadFileTree,
      revealFolder,
    }));

    await act(async () => {
      window.dispatchEvent(createDropEvent([createDropFile('/outside/alpha.md')]));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(importExternalMarkdownEntries).toHaveBeenCalledWith('/vault', '', ['/outside/alpha.md']);
    });
    expect(loadFileTree).toHaveBeenCalledWith(true);
    expect(revealFolder).toHaveBeenCalledWith('');
    expect(mocks.messageDialog).not.toHaveBeenCalled();
  });
});
