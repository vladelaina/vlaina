import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentNotesRootExternalPathSync } from './useCurrentNotesRootExternalPathSync';
import { looksLikeNotesRootRoot } from './currentNotesRootExternalPathSyncUtils';

type WatchEvent = {
  type: unknown;
  paths: string[];
};

const hoisted = vi.hoisted(() => ({
  syncCurrentNotesRootExternalPath: vi.fn(),
  watchHandler: null as ((event: WatchEvent) => void | Promise<void>) | null,
  watchPaths: {
    normalizedNotesRootPath: '/home/user/notesRoot',
    normalizedParentPath: '/home/user',
    watchParentPath: '/home/user',
  },
  renamePaths: null as { oldPath: string | null; newPath: string | null } | null,
  watchDesktopPath: vi.fn(async (_path: string, handler: (event: WatchEvent) => void | Promise<void>) => {
    hoisted.watchHandler = handler;
    return vi.fn(async () => undefined);
  }),
  releaseWatcher: vi.fn(),
}));

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: hoisted.watchDesktopPath,
}));

vi.mock('@/stores/notesRootConfig', () => ({
  ensureNotesRootConfig: vi.fn(async () => undefined),
}));

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: (selector: (state: { syncCurrentNotesRootExternalPath: typeof hoisted.syncCurrentNotesRootExternalPath }) => unknown) =>
    selector({ syncCurrentNotesRootExternalPath: hoisted.syncCurrentNotesRootExternalPath }),
}));

vi.mock('@/stores/notes/document/externalSyncControl', () => ({
  isExternalSyncPaused: vi.fn(() => false),
  subscribeExternalSyncPause: vi.fn(() => () => {}),
  registerExternalSyncWatcher: vi.fn(() => hoisted.releaseWatcher),
}));

vi.mock('@/stores/notes/document/externalChangeRegistry', () => ({
  shouldIgnoreExpectedExternalChange: vi.fn(() => false),
}));

vi.mock('./currentNotesRootExternalPathSyncUtils', () => ({
  getNotesRootExternalWatchPaths: vi.fn(() => hoisted.watchPaths),
  isDirectChildPath: vi.fn(() => true),
  looksLikeNotesRootRoot: vi.fn(async () => true),
}));

vi.mock('./notesExternalSyncUtils', () => ({
  getAbsoluteRenameWatchPaths: vi.fn(() => hoisted.renamePaths),
  getFsPathComparisonKey: (path: string) => (
    /^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path
  ),
  isCreateWatchEvent: (event: WatchEvent) =>
    typeof event.type === 'object' && event.type !== null && 'create' in event.type,
  isRemoveWatchEvent: (event: WatchEvent) =>
    typeof event.type === 'object' && event.type !== null && 'remove' in event.type,
  normalizeFsPath: (path: string) => path.replace(/\\/g, '/'),
}));

describe('useCurrentNotesRootExternalPathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.watchHandler = null;
    hoisted.watchPaths = {
      normalizedNotesRootPath: '/home/user/notesRoot',
      normalizedParentPath: '/home/user',
      watchParentPath: '/home/user',
    };
    hoisted.renamePaths = null;
  });

  it('watches the notesRoot parent directory non-recursively', async () => {
    renderHook(() => useCurrentNotesRootExternalPathSync('/home/user/notesRoot'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(hoisted.watchDesktopPath).toHaveBeenCalledWith(
      '/home/user',
      expect.any(Function),
      { recursive: false }
    );
  });

  it('syncs a Windows notesRoot rename when watcher paths differ only by case', async () => {
    hoisted.watchPaths = {
      normalizedNotesRootPath: 'C:/Users/Me/NotesRoot',
      normalizedParentPath: 'C:/Users/Me',
      watchParentPath: 'C:/Users/Me',
    };
    hoisted.renamePaths = {
      oldPath: 'c:/users/me/notesRoot',
      newPath: 'c:/users/me/notes-root-renamed',
    };

    renderHook(() => useCurrentNotesRootExternalPathSync('C:/Users/Me/NotesRoot'));

    await act(async () => {
      await Promise.resolve();
      await hoisted.watchHandler?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['c:/users/me/notesRoot', 'c:/users/me/notes-root-renamed'],
      });
    });

    expect(hoisted.syncCurrentNotesRootExternalPath).toHaveBeenCalledWith('c:/users/me/notes-root-renamed');
  });

  it('ignores candidate notesRoot roots when storage checks fail', async () => {
    hoisted.renamePaths = {
      oldPath: '/home/user/notesRoot',
      newPath: '/home/user/notes-root-renamed',
    };
    vi.mocked(looksLikeNotesRootRoot).mockRejectedValueOnce(new Error('stat failed'));

    renderHook(() => useCurrentNotesRootExternalPathSync('/home/user/notesRoot'));

    await act(async () => {
      await Promise.resolve();
      await hoisted.watchHandler?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/home/user/notesRoot', '/home/user/notes-root-renamed'],
      });
    });

    expect(hoisted.syncCurrentNotesRootExternalPath).not.toHaveBeenCalled();
  });

  it('matches split Windows notesRoot remove and create events case-insensitively', async () => {
    hoisted.watchPaths = {
      normalizedNotesRootPath: 'C:/Users/Me/NotesRoot',
      normalizedParentPath: 'C:/Users/Me',
      watchParentPath: 'C:/Users/Me',
    };

    renderHook(() => useCurrentNotesRootExternalPathSync('C:/Users/Me/NotesRoot'));

    await act(async () => {
      await Promise.resolve();
      await hoisted.watchHandler?.({
        type: { remove: { kind: 'folder' } },
        paths: ['c:/users/me/notesRoot'],
      });
      await hoisted.watchHandler?.({
        type: { create: { kind: 'folder' } },
        paths: ['c:/users/me/notes-root-renamed'],
      });
    });

    expect(hoisted.syncCurrentNotesRootExternalPath).toHaveBeenCalledWith('c:/users/me/notes-root-renamed');
  });
});
