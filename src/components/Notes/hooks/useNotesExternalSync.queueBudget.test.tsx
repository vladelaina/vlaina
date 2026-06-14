import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_EXTERNAL_WATCH_EVENT_PATHS,
  MAX_PENDING_EXTERNAL_PATH_EVENTS,
} from './notesExternalSyncActions';
import { useNotesExternalSync } from './useNotesExternalSync';
import { buildExternalTreeSnapshot, detectExternalTreePathChanges } from './notesExternalPollingUtils';

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
    notesPath: '/vault',
    currentNote: { path: 'docs/current.md' } as { path: string } | null,
    isDirty: false,
    rootFolder: { children: [] as unknown[] } as { children: unknown[] } | null,
    openTabs: [] as Array<{ path: string }>,
    recentNotes: [] as string[],
    noteContentsCache: new Map<string, unknown>(),
    noteMetadata: { notes: {} as Record<string, unknown> },
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
    subscribeNotesExternalPathRename: vi.fn(() => () => {}),
    readNotesExternalPathEvents: vi.fn(async () => [] as Array<{ nonce: string; oldPath: string; newPath: string }>),
  };
});

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: hoisted.watchDesktopPath,
}));

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/'),
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/'),
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
  getNotesExternalPathEventsRelativePath: () => '__vlaina_system__/external-path-events.json',
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

describe('useNotesExternalSync queue budgets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    hoisted.watchHandler = null;
    hoisted.notesState.notesPath = '/vault';
    hoisted.notesState.currentNote = { path: 'docs/current.md' };
    hoisted.notesState.rootFolder = { children: [] };
    hoisted.notesState.openTabs = [];
    hoisted.notesState.recentNotes = [];
    hoisted.notesState.noteContentsCache = new Map();
    hoisted.notesState.noteMetadata = { notes: {} };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconciles and reloads instead of growing pending create queues without bound', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { create: { kind: 'file' } },
        paths: Array.from(
          { length: MAX_PENDING_EXTERNAL_PATH_EVENTS + 5 },
          (_value, index) => `/vault/docs/new-${index}.md`,
        ),
      });
      await vi.advanceTimersByTimeAsync(181);
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(buildExternalTreeSnapshot).toHaveBeenCalledWith('/vault');
    expect(detectExternalTreePathChanges).toHaveBeenCalled();
    expect(hoisted.notesState.loadFileTree).toHaveBeenCalledWith(true);

    hook.unmount();
  });

  it('reconciles oversized native watch events without normalizing every path', async () => {
    const hook = renderHook(() => useNotesExternalSync('/vault', '/vault'));

    await act(async () => {
      await hoisted.watchHandler?.({
        type: { create: { kind: 'file' } },
        paths: Array.from(
          { length: MAX_EXTERNAL_WATCH_EVENT_PATHS + 1 },
          (_value, index) => `/vault/docs/new-${index}.md`,
        ),
      });
    });

    expect(buildExternalTreeSnapshot).toHaveBeenCalledWith('/vault');
    expect(detectExternalTreePathChanges).toHaveBeenCalled();
    expect(hoisted.notesState.invalidateNoteCache).not.toHaveBeenCalled();

    hook.unmount();
  });
});
