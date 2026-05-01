import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesExternalSync } from './useNotesExternalSync';
import { detectExternalTreePathChanges } from './notesExternalPollingUtils';

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
    unwatch: vi.fn(async () => undefined) as () => Promise<void>,
    releaseWatcher: vi.fn(),
    watchDesktopPath: vi.fn(async (_path: string, handler: (event: WatchEvent) => void | Promise<void>) => {
      hoisted.watchHandler = handler;
      return hoisted.unwatch;
    }),
    renameBroadcastHandler: null as ((event: { nonce: string; oldPath: string; newPath: string }) => void) | null,
    unsubscribeRenameBroadcast: vi.fn(),
    subscribeNotesExternalPathRename: vi.fn(
      (_notesPath: string, handler: (event: { nonce: string; oldPath: string; newPath: string }) => void) => {
        hoisted.renameBroadcastHandler = handler;
        return hoisted.unsubscribeRenameBroadcast;
      }
    ),
    readNotesExternalPathEvents: vi.fn(async () => [] as Array<{ nonce: string; oldPath: string; newPath: string }>),
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

vi.mock('@/stores/notes/document/externalChangeRegistry', () => ({
  shouldIgnoreExpectedExternalChange: vi.fn(() => false),
}));

vi.mock('@/stores/notes/document/externalSyncControl', () => ({
  isExternalSyncPaused: vi.fn(() => false),
  subscribeExternalSyncPause: vi.fn(() => () => {}),
  registerExternalSyncWatcher: vi.fn(() => hoisted.releaseWatcher),
}));

vi.mock('@/stores/notes/document/externalPathBroadcast', () => ({
  getNotesExternalPathEventsRelativePath: () => '.vlaina/store/external-path-events.json',
  readNotesExternalPathEvents: hoisted.readNotesExternalPathEvents,
  subscribeNotesExternalPathRename: hoisted.subscribeNotesExternalPathRename,
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
    hoisted.renameBroadcastHandler = null;
    hoisted.notesState.currentNote = { path: 'docs/current.md' };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconciles the current note without reloading the tree after an external current-note change', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    expect(hoisted.watchDesktopPath).toHaveBeenCalledWith(
      '/vault',
      expect.any(Function),
      { recursive: true }
    );

    await act(async () => {
      await hoisted.watchHandler?.({
        type: 'modify',
        paths: ['/vault/docs/current.md'],
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.notesState.syncCurrentNoteFromDisk).toHaveBeenCalledTimes(1);
    expect(hoisted.notesState.syncCurrentNoteFromDisk).toHaveBeenCalledWith({ force: true });
    expect(hoisted.notesState.invalidateNoteCache).not.toHaveBeenCalled();
    expect(hoisted.notesState.loadFileTree).not.toHaveBeenCalled();

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

  it('ignores watch events outside the active notes path even if the vault path is broader', async () => {
    const hook = renderHook(() => useNotesExternalSync('/home/user', '/home/user/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: 'modify',
        paths: ['/home/user/.cache/firefox/cache-entry'],
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.notesState.syncCurrentNoteFromDisk).not.toHaveBeenCalled();
    expect(hoisted.notesState.invalidateNoteCache).not.toHaveBeenCalled();
    expect(hoisted.notesState.loadFileTree).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('applies external deletions before reloading the tree', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { remove: { kind: 'file' } },
        paths: ['/vault/docs/removed.md'],
      });
      await vi.advanceTimersByTimeAsync(401);
    });

    expect(hoisted.notesState.applyExternalPathDeletion).toHaveBeenCalledWith('docs/removed.md');
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('treats paired remove and create events as an external rename', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { remove: { kind: 'file' } },
        paths: ['/vault/docs/alpha.md'],
      });
      await hoisted.watchHandler?.({
        type: { create: { kind: 'file' } },
        paths: ['/vault/docs/beta.md'],
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.notesState.applyExternalPathRename).toHaveBeenCalledWith('docs/alpha.md', 'docs/beta.md');
    expect(hoisted.notesState.applyExternalPathDeletion).not.toHaveBeenCalled();
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('treats paired create and remove events as an external rename', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { create: { kind: 'file' } },
        paths: ['/vault/docs/beta.md'],
      });
      await hoisted.watchHandler?.({
        type: { remove: { kind: 'file' } },
        paths: ['/vault/docs/alpha.md'],
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.notesState.applyExternalPathRename).toHaveBeenCalledWith('docs/alpha.md', 'docs/beta.md');
    expect(hoisted.notesState.applyExternalPathDeletion).not.toHaveBeenCalled();
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('reloads the tree for a standalone external create after the rename window expires', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { create: { kind: 'file' } },
        paths: ['/vault/docs/new.md'],
      });
      await vi.advanceTimersByTimeAsync(401);
    });

    expect(hoisted.notesState.applyExternalPathRename).not.toHaveBeenCalled();
    expect(hoisted.notesState.invalidateNoteCache).toHaveBeenCalledWith('docs/new.md');
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('reconciles a single create event as a rename when the tree diff matches one', async () => {
    vi.mocked(detectExternalTreePathChanges).mockReturnValueOnce({
      hasChanges: true,
      renames: [{ oldPath: 'docs/alpha.md', newPath: 'docs/beta.md' }],
      deletions: [],
      hasAdditions: false,
    });
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { create: { kind: 'file' } },
        paths: ['/vault/docs/beta.md'],
      });
      await vi.advanceTimersByTimeAsync(181);
    });

    expect(hoisted.notesState.applyExternalPathRename).toHaveBeenCalledWith('docs/alpha.md', 'docs/beta.md');
    expect(hoisted.notesState.applyExternalPathDeletion).not.toHaveBeenCalled();
    expect(hoisted.notesState.loadFileTree).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('applies semantic rename broadcasts from another window', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      hoisted.renameBroadcastHandler?.({
        nonce: 'rename-event-1',
        oldPath: 'docs/alpha.md',
        newPath: 'docs/beta.md',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hoisted.subscribeNotesExternalPathRename).toHaveBeenCalledWith('/vault', expect.any(Function));
    expect(hoisted.notesState.applyExternalPathRename).toHaveBeenCalledWith('docs/alpha.md', 'docs/beta.md');
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
    expect(hoisted.unsubscribeRenameBroadcast).toHaveBeenCalled();
  });

  it('applies rename events written to the vault event file', async () => {
    hoisted.readNotesExternalPathEvents.mockResolvedValueOnce([
      {
        nonce: 'rename-file-event-1',
        oldPath: 'docs/alpha.md',
        newPath: 'docs/beta.md',
      },
    ]);
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { modify: { kind: 'data', mode: 'any' } },
        paths: ['/vault/.vlaina/store/external-path-events.json'],
      });
      await Promise.resolve();
    });

    expect(hoisted.readNotesExternalPathEvents).toHaveBeenCalledWith('/vault', {
      afterStamp: expect.any(Number),
    });
    expect(hoisted.notesState.applyExternalPathRename).toHaveBeenCalledWith('docs/alpha.md', 'docs/beta.md');
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('unwatches if the effect is disposed before the async watcher resolves', async () => {
    let resolveWatch: ((unwatch: () => Promise<void>) => void) | null = null;
    hoisted.watchDesktopPath.mockImplementationOnce(async (_path, handler) => {
      hoisted.watchHandler = handler;
      return await new Promise<() => Promise<void>>((resolve) => {
        resolveWatch = resolve;
      });
    });

    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    hook.unmount();

    await act(async () => {
      resolveWatch?.(hoisted.unwatch);
      await Promise.resolve();
    });

    expect(hoisted.unwatch).toHaveBeenCalledTimes(1);
    expect(hoisted.releaseWatcher).not.toHaveBeenCalled();
  });
});
