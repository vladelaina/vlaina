import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAbsoluteNoteExternalRenameSync } from './useAbsoluteNoteExternalRenameSync';

type WatchEvent = {
  type: unknown;
  paths: string[];
};

const hoisted = vi.hoisted(() => {
  const notesState = {
    applyExternalPathRename: vi.fn(async () => undefined),
    syncCurrentNoteFromDisk: vi.fn(async () => 'unchanged' as const),
  };

  return {
    notesState,
    watchHandler: null as ((event: WatchEvent) => void | Promise<void>) | null,
    unwatch: vi.fn(async () => undefined),
    watchDesktopPath: vi.fn(async (_path: string, handler: (event: WatchEvent) => void | Promise<void>) => {
      hoisted.watchHandler = handler;
      return hoisted.unwatch;
    }),
    unsubscribeRenameBroadcast: vi.fn(),
    subscribeNotesExternalPathRename: vi.fn(() => hoisted.unsubscribeRenameBroadcast),
    readNotesExternalPathEvents: vi.fn(async () => [] as Array<{ nonce: string; oldPath: string; newPath: string }>),
  };
});

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: hoisted.watchDesktopPath,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index > 0 ? normalized.slice(0, index) : null;
  },
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

vi.mock('@/stores/notes/document/externalPathBroadcast', () => ({
  getNotesExternalPathEventsRelativePath: () => '__vlaina_system__/external-path-events.json',
  readNotesExternalPathEvents: hoisted.readNotesExternalPathEvents,
  subscribeNotesExternalPathRename: hoisted.subscribeNotesExternalPathRename,
}));

describe('useAbsoluteNoteExternalRenameSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.watchHandler = null;
  });

  it('syncs an open absolute note after a content watch event', async () => {
    const hook = renderHook(() => useAbsoluteNoteExternalRenameSync('/external/docs/current.md'));

    expect(hoisted.watchDesktopPath).toHaveBeenCalledWith(
      '/external/docs',
      expect.any(Function),
      { recursive: true },
    );

    await act(async () => {
      await hoisted.watchHandler?.({
        type: 'modify',
        paths: ['/external/docs/current.md'],
      });
    });

    expect(hoisted.notesState.syncCurrentNoteFromDisk).toHaveBeenCalledWith({ force: true });
    expect(hoisted.notesState.applyExternalPathRename).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('keeps absolute rename sync behavior for rename watch events', async () => {
    const hook = renderHook(() => useAbsoluteNoteExternalRenameSync('/external/docs/current.md'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/external/docs/current.md', '/external/docs/renamed.md'],
      });
    });

    expect(hoisted.notesState.applyExternalPathRename).toHaveBeenCalledWith(
      '/external/docs/current.md',
      '/external/docs/renamed.md',
    );
    expect(hoisted.notesState.syncCurrentNoteFromDisk).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('syncs an open absolute note deletion without treating it as a rename', async () => {
    const hook = renderHook(() => useAbsoluteNoteExternalRenameSync('/external/docs/current.md'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { remove: { kind: 'file' } },
        paths: ['/external/docs/current.md'],
      });
    });

    expect(hoisted.notesState.syncCurrentNoteFromDisk).toHaveBeenCalledWith({ force: true });
    expect(hoisted.notesState.applyExternalPathRename).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('avoids native directory watching when an absolute note lives directly in the home directory', async () => {
    const hook = renderHook(() => useAbsoluteNoteExternalRenameSync('/home/user/current.md'));

    expect(hoisted.watchDesktopPath).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(hoisted.notesState.syncCurrentNoteFromDisk).toHaveBeenCalledWith({ force: true });

    hook.unmount();
  });
});
