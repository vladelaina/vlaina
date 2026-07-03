import { afterEach, describe, expect, it, vi } from 'vitest';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('notesRootStoreSupport broadcast channel guards', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('rejects malformed notesRoot broadcast messages', async () => {
    const { parseNotesRootBroadcastMessage } = await import('./notesRootStoreSupport');

    expect(parseNotesRootBroadcastMessage(null)).toBeNull();
    expect(parseNotesRootBroadcastMessage('query')).toBeNull();
    expect(parseNotesRootBroadcastMessage({ type: 'query', requestId: '', notesRootPath: '/notesRoot' })).toBeNull();
    expect(parseNotesRootBroadcastMessage({ type: 'query', requestId: 'r'.repeat(129), notesRootPath: '/notesRoot' })).toBeNull();
    expect(parseNotesRootBroadcastMessage({ type: 'query', requestId: 'req-1', notesRootPath: 'v'.repeat(4097) })).toBeNull();
    expect(parseNotesRootBroadcastMessage({ type: 'query', requestId: 'req-1', notesRootPath: 'relative/notesRoot' })).toBeNull();
    expect(parseNotesRootBroadcastMessage({ type: 'query', requestId: 'req-1', notesRootPath: '/notesRoot/unsafe\u202Egnp' })).toBeNull();
    expect(parseNotesRootBroadcastMessage({ type: 'response', requestId: 'req-1', responseLabel: 'L'.repeat(513) })).toBeNull();
    expect(parseNotesRootBroadcastMessage({ type: 'unknown', requestId: 'req-1' })).toBeNull();
  });

  it('normalizes valid notesRoot broadcast messages', async () => {
    const { parseNotesRootBroadcastMessage } = await import('./notesRootStoreSupport');

    expect(parseNotesRootBroadcastMessage({ type: 'query', requestId: 'req-1', notesRootPath: '\\notesRoot\\docs' })).toEqual({
      type: 'query',
      requestId: 'req-1',
      notesRootPath: '/notesRoot/docs',
    });
    expect(parseNotesRootBroadcastMessage({ type: 'response', requestId: 'req-1', responseLabel: 'Main window' })).toEqual({
      type: 'response',
      requestId: 'req-1',
      responseLabel: 'Main window',
    });
    expect(parseNotesRootBroadcastMessage({ type: 'response', requestId: 'req-1', responseLabel: null })).toEqual({
      type: 'response',
      requestId: 'req-1',
      responseLabel: null,
    });
  });

  it('does not throw when BroadcastChannel construction fails', async () => {
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('broadcast unavailable');
      }
    });
    const { setupBroadcastChannel } = await import('./notesRootStoreSupport');

    expect(() => setupBroadcastChannel()).not.toThrow();
  });

  it('resolves notes-root-open queries when BroadcastChannel postMessage fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage() {
        throw new Error('post failed');
      }
      close() {}
    });
    const { queryNotesRootOpenInOtherWindow } = await import('./notesRootStoreSupport');

    const query = queryNotesRootOpenInOtherWindow('/notesRoot');
    await vi.advanceTimersByTimeAsync(200);

    await expect(query).resolves.toBeNull();
  });

  it('bounds pending notes-root-open broadcast queries', async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage = postMessage;
      close() {}
    });
    const {
      MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES,
      queryNotesRootOpenInOtherWindow,
    } = await import('./notesRootStoreSupport');

    const queries = Array.from(
      { length: MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES },
      (_value, index) => queryNotesRootOpenInOtherWindow(`/notes-root-${index}`),
    );

    expect(postMessage).toHaveBeenCalledTimes(MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES);
    await expect(queryNotesRootOpenInOtherWindow('/notes-root-overflow')).resolves.toBeNull();
    expect(postMessage).toHaveBeenCalledTimes(MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES);

    await vi.advanceTimersByTimeAsync(200);
    await expect(Promise.all(queries)).resolves.toEqual(
      Array.from({ length: MAX_PENDING_NOTES_ROOT_BROADCAST_QUERIES }, () => null)
    );
  });
});

describe('notesRootStoreSupport persistence merging', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('preserves recent notes-roots added by another window during a stale file save', async () => {
    vi.useFakeTimers();
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/notes/state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentNotesRoots: [
          { id: 'notes-root-other', name: 'Other', path: '/notesRoot/other', lastOpened: 2 },
        ],
        currentNotesRootId: 'notes-root-other',
        deletedNotesRootPaths: [],
      })),
      stat: vi.fn(async () => ({ isDirectory: false, isFile: true })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { persistNotesRootState } = await import('./notesRootStoreSupport');
    persistNotesRootState([
      { id: 'notes-root-local', name: 'Local', path: '/notesRoot/local', lastOpened: 1 },
    ], 'notes-root-local');

    await vi.runAllTimersAsync();
    await Promise.resolve();

    const writeCalls = storage.writeFile.mock.calls as unknown as Array<[string, string]>;
    const payload = JSON.parse(String(writeCalls[0]?.[1]));
    expect(storage.readFile).toHaveBeenCalledWith('/app/.vlaina/notes/state.json', 256 * 1024);
    expect(payload.recentNotesRoots.map((notesRoot: { id: string }) => notesRoot.id)).toEqual([
      'notes-root-local',
      'notes-root-other',
    ]);
    expect(payload.currentNotesRootId).toBe('notes-root-local');
  });

  it('serializes notesRoot state file writes so the latest current folder wins', async () => {
    const firstWrite = createDeferred();
    let writeCount = 0;
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async () => false),
      readFile: vi.fn(async () => {
        throw new Error('Missing state files should not be read');
      }),
      stat: vi.fn(async () => null),
      writeFile: vi.fn(async () => {
        writeCount += 1;
        if (writeCount === 1) {
          await firstWrite.promise;
        }
      }),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { persistNotesRootState } = await import('./notesRootStoreSupport');
    persistNotesRootState([
      { id: 'notes-root-a', name: 'A', path: '/notesRoot/a', lastOpened: 1 },
    ], 'notes-root-a');

    await vi.waitFor(() => {
      expect(storage.writeFile).toHaveBeenCalledTimes(1);
    });

    persistNotesRootState([
      { id: 'notes-root-b', name: 'B', path: '/notesRoot/b', lastOpened: 2 },
    ], 'notes-root-b');
    await Promise.resolve();
    expect(storage.writeFile).toHaveBeenCalledTimes(1);

    firstWrite.resolve();

    await vi.waitFor(() => {
      expect(storage.writeFile).toHaveBeenCalledTimes(2);
    });

    const writeCalls = storage.writeFile.mock.calls as unknown as Array<[string, string]>;
    const latestPayload = JSON.parse(String(writeCalls.at(-1)?.[1]));
    expect(latestPayload.currentNotesRootId).toBe('notes-root-b');
    expect(latestPayload.recentNotesRoots).toEqual([
      expect.objectContaining({ id: 'notes-root-b', path: '/notesRoot/b' }),
    ]);
  });

  it('writes tombstone-filtered merged notesRoot state back to localStorage', async () => {
    const removedNotesRoot = { id: 'notes-root-removed', name: 'Removed', path: '/notesRoot/removed', lastOpened: 1 };
    const keptNotesRoot = { id: 'notes-root-kept', name: 'Kept', path: '/notesRoot/kept', lastOpened: 2 };
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/notes/state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentNotesRoots: [removedNotesRoot],
        currentNotesRootId: 'notes-root-removed',
        deletedNotesRootPaths: ['/notesRoot/removed'],
      })),
      stat: vi.fn(async () => ({ isDirectory: false, isFile: true })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { NOTES_ROOTS_STORAGE_KEY, persistNotesRootState } = await import('./notesRootStoreSupport');
    persistNotesRootState([removedNotesRoot, keptNotesRoot], 'notes-root-kept');

    await vi.waitFor(() => {
      expect(storage.writeFile).toHaveBeenCalledTimes(1);
    });

    const writeCalls = storage.writeFile.mock.calls as unknown as Array<[string, string]>;
    const payload = JSON.parse(String(writeCalls[0]?.[1]));
    expect(payload.recentNotesRoots).toEqual([
      expect.objectContaining({ id: 'notes-root-kept', path: '/notesRoot/kept' }),
    ]);
    expect(payload.currentNotesRootId).toBe('notes-root-kept');
    expect(payload.deletedNotesRootPaths).toEqual(['/notesRoot/removed']);
    expect(JSON.parse(localStorage.getItem(NOTES_ROOTS_STORAGE_KEY) || '[]')).toEqual([
      expect.objectContaining({ id: 'notes-root-kept', path: '/notesRoot/kept' }),
    ]);
  });

  it('bounds deleted notesRoot tombstones persisted to the state file', async () => {
    const deletedNotesRootPaths = Array.from({ length: 120 }, (_value, index) => `/notesRoot/deleted-${index}`);
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/notes/state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentNotesRoots: [],
        currentNotesRootId: null,
        deletedNotesRootPaths,
      })),
      stat: vi.fn(async () => ({ isDirectory: false, isFile: true })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { persistNotesRootState } = await import('./notesRootStoreSupport');
    persistNotesRootState([], null);

    await vi.waitFor(() => {
      expect(storage.writeFile).toHaveBeenCalledTimes(1);
    });

    const writeCalls = storage.writeFile.mock.calls as unknown as Array<[string, string]>;
    const payload = JSON.parse(String(writeCalls[0]?.[1]));
    expect(payload.deletedNotesRootPaths).toHaveLength(100);
    expect(payload.deletedNotesRootPaths[0]).toBe('/notesRoot/deleted-20');
    expect(payload.deletedNotesRootPaths.at(-1)).toBe('/notesRoot/deleted-119');
  });

  it('does not resurrect a notesRoot explicitly removed from recent list', async () => {
    vi.useFakeTimers();
    const removedNotesRoot = { id: 'notes-root-removed', name: 'Removed', path: '/notesRoot/removed', lastOpened: 1 };
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/notes/state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentNotesRoots: [removedNotesRoot],
        currentNotesRootId: 'notes-root-removed',
        deletedNotesRootPaths: [],
      })),
      stat: vi.fn(async () => ({ size: 256 })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { removeRecentNotesRootAction } = await import('./notesRootStoreSupport');
    removeRecentNotesRootAction({
      id: removedNotesRoot.id,
      recentNotesRoots: [removedNotesRoot],
      currentNotesRoot: removedNotesRoot,
      set: vi.fn(),
    });

    await vi.runAllTimersAsync();
    await Promise.resolve();

    const writeCalls = storage.writeFile.mock.calls as unknown as Array<[string, string]>;
    const payload = JSON.parse(String(writeCalls[0]?.[1]));
    expect(payload.recentNotesRoots).toEqual([]);
    expect(payload.deletedNotesRootPaths).toEqual(['/notesRoot/removed']);
    expect(payload.currentNotesRootId).toBeNull();
  });

  it('reads notesRoot state files when stat has no size', async () => {
    vi.useFakeTimers();
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/notes/state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentNotesRoots: [
          { id: 'notes-root-other', name: 'Other', path: '/notesRoot/other', lastOpened: 2 },
        ],
        currentNotesRootId: 'notes-root-other',
        deletedNotesRootPaths: [],
      })),
      stat: vi.fn(async () => ({})),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { loadPersistedNotesRootState } = await import('./notesRootStoreSupport');
    const state = await loadPersistedNotesRootState();

    expect(state.recentNotesRoots).toEqual([
      { id: 'notes-root-other', name: 'Other', path: '/notesRoot/other', lastOpened: 2 },
    ]);
    expect(storage.readFile).toHaveBeenCalledWith('/app/.vlaina/notes/state.json', 256 * 1024);
  });

  it('does not read notesRoot state files with invalid known stat sizes', async () => {
    vi.useFakeTimers();
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/notes/state.json'),
      readFile: vi.fn(async () => {
        throw new Error('Invalid stat size should not be read');
      }),
      stat: vi.fn(async () => ({ size: -1 })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { loadPersistedNotesRootState } = await import('./notesRootStoreSupport');
    const state = await loadPersistedNotesRootState();

    expect(state.recentNotesRoots).toEqual([]);
    expect(storage.readFile).not.toHaveBeenCalled();
  });

  it('does not parse notesRoot state files that exceed the limit after read', async () => {
    vi.useFakeTimers();
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/notes/state.json'),
      readFile: vi.fn(async () => '你'.repeat(Math.floor((256 * 1024) / 3) + 1)),
      stat: vi.fn(async () => ({ size: 256 })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
    }));

    const { loadPersistedNotesRootState } = await import('./notesRootStoreSupport');
    const state = await loadPersistedNotesRootState();

    expect(state.recentNotesRoots).toEqual([]);
    expect(storage.readFile).toHaveBeenCalledWith('/app/.vlaina/notes/state.json', 256 * 1024);
  });
});

describe('notesRootStoreSupport local storage guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not parse oversized recent notesRoot storage values', async () => {
    const parseSpy = vi.spyOn(JSON, 'parse');
    const { parseRecentNotesRootsStorageValue } = await import('./notesRootStoreSupport');

    expect(parseRecentNotesRootsStorageValue('['.padEnd(70 * 1024, ' '))).toEqual([]);
    expect(parseSpy).not.toHaveBeenCalled();
  });

  it('skips malformed recent notesRoot entries without dropping valid entries', async () => {
    const { parseRecentNotesRootsStorageValue } = await import('./notesRootStoreSupport');

    expect(parseRecentNotesRootsStorageValue(JSON.stringify([
      { id: 'notes-root-a', name: 'A', path: '/notesRoot/a', lastOpened: 1 },
      null,
      { id: 'notes-root-bad', name: 'Bad', path: 42, lastOpened: 2 },
      { id: 'notes-root-b', name: 'B', path: '/notesRoot/b', lastOpened: 3 },
    ]))).toEqual([
      { id: 'notes-root-a', name: 'A', path: '/notesRoot/a', lastOpened: 1 },
      { id: 'notes-root-b', name: 'B', path: '/notesRoot/b', lastOpened: 3 },
    ]);
  });

  it('rejects overlong recent opened folder paths before normalization', async () => {
    const { parseRecentNotesRootsStorageValue } = await import('./notesRootStoreSupport');

    expect(parseRecentNotesRootsStorageValue(JSON.stringify([
      { id: 'notes-root-a', name: 'A', path: `/notesRoot/${'a'.repeat(4096)}`, lastOpened: 1 },
      { id: 'notes-root-b', name: 'B', path: '/notesRoot/b', lastOpened: 2 },
    ]))).toEqual([
      { id: 'notes-root-b', name: 'B', path: '/notesRoot/b', lastOpened: 2 },
    ]);
  });

  it('rejects unsafe and non-absolute recent opened folder paths', async () => {
    const { parseRecentNotesRootsStorageValue } = await import('./notesRootStoreSupport');

    expect(parseRecentNotesRootsStorageValue(JSON.stringify([
      { id: 'notes-root-relative', name: 'Relative', path: 'notesRoot/relative', lastOpened: 1 },
      { id: 'notes-root-bidi', name: 'Bidi', path: '/notesRoot/unsafe\u202Egnp', lastOpened: 2 },
      { id: 'notes-root-control', name: 'Control', path: '/notesRoot/unsafe\0hidden', lastOpened: 3 },
      { id: 'notes-root-valid', name: 'Valid', path: '\\notesRoot\\valid\\', lastOpened: 4 },
    ]))).toEqual([
      { id: 'notes-root-valid', name: 'Valid', path: '/notesRoot/valid', lastOpened: 4 },
    ]);
  });
});
