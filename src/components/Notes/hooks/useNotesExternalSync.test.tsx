import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesExternalSync } from './useNotesExternalSync';

type WatchEvent = {
  type: unknown;
  paths: string[];
};

const hoisted = vi.hoisted(() => {
  const notesState = {
    loadFileTree: vi.fn(async () => undefined),
    invalidateNoteCache: vi.fn(),
    syncCurrentNoteFromDisk: vi.fn(async () => 'unchanged' as const),
    applyExternalPathRename: vi.fn(async () => undefined),
    applyExternalPathDeletion: vi.fn(async () => undefined),
    currentNote: { path: 'docs/current.md' } as { path: string } | null,
    isDirty: false,
    rootFolder: { children: [] as unknown[] } as { children: unknown[] } | null,
  };

  return {
    notesState,
    watchHandler: null as ((event: WatchEvent) => void | Promise<void>) | null,
    unwatch: vi.fn(),
    releaseWatcher: vi.fn(),
    watchDesktopPath: vi.fn(async (_path: string, handler: (event: WatchEvent) => void | Promise<void>) => {
      hoisted.watchHandler = handler;
      return hoisted.unwatch;
    }),
  };
});

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: hoisted.watchDesktopPath,
}));

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/'),
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector: (state: typeof hoisted.notesState) => unknown) => selector(hoisted.notesState),
    {
      getState: () => hoisted.notesState,
    },
  ),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: vi.fn(),
    }),
  },
}));

vi.mock('@/stores/notes/document/externalChangeRegistry', () => ({
  shouldIgnoreExpectedExternalChange: vi.fn(() => false),
}));

vi.mock('@/stores/notes/document/externalSyncControl', () => ({
  isExternalSyncPaused: vi.fn(() => false),
  subscribeExternalSyncPause: vi.fn(() => () => {}),
  registerExternalSyncWatcher: vi.fn(() => hoisted.releaseWatcher),
}));

vi.mock('./notesExternalPollingUtils', () => ({
  buildExternalTreeSnapshot: vi.fn(async () => []),
  detectExternalTreePathChanges: vi.fn(() => ({
    hasChanges: false,
    renames: [],
    deletions: [],
    hasAdditions: false,
  })),
}));

vi.mock('@/stores/notes/debugLog', () => ({
  logNotesDebug: vi.fn(),
}));

describe('useNotesExternalSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    hoisted.watchHandler = null;
    hoisted.notesState.currentNote = { path: 'docs/current.md' };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconciles the current note and reloads the tree after an external current-note change', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: 'modify',
        paths: ['/vault/docs/current.md'],
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.notesState.syncCurrentNoteFromDisk).toHaveBeenCalledTimes(1);
    expect(hoisted.notesState.invalidateNoteCache).not.toHaveBeenCalled();
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('invalidates non-current note cache and reloads the tree after an external change', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: 'modify',
        paths: ['/vault/docs/other.md'],
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.notesState.syncCurrentNoteFromDisk).not.toHaveBeenCalled();
    expect(hoisted.notesState.invalidateNoteCache).toHaveBeenCalledWith('docs/other.md');
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('applies external deletions before reloading the tree', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { remove: { kind: 'file' } },
        paths: ['/vault/docs/removed.md'],
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.notesState.applyExternalPathDeletion).toHaveBeenCalledWith('docs/removed.md');
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });
});
