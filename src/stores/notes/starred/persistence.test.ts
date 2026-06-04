import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarredEntry } from '../types';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
  stat: vi.fn<
    (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size?: number } | null>
  >(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
};

const storageAutoSync = vi.hoisted(() => ({
  emitStorageAutoSyncEvent: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

vi.mock('@/lib/storage/paths', () => ({
  ensureDirectories: () => Promise.resolve(),
  getPaths: () => Promise.resolve({ store: '/store' }),
}));

vi.mock('@/lib/storage/storageAutoSync', () => ({
  emitStorageAutoSyncEvent: storageAutoSync.emitStorageAutoSyncEvent,
}));

function createEntry(
  id: string,
  kind: 'note' | 'folder',
  vaultPath: string,
  relativePath: string
): StarredEntry {
  return {
    id,
    kind,
    vaultPath,
    relativePath,
    addedAt: 1,
  };
}

describe('starred persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces queued starred writes', async () => {
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([createEntry('1', 'note', 'C:/vault-a', 'first.md')]);
    persistence.saveStarredRegistry([createEntry('2', 'note', 'C:/vault-a', 'second.md')]);

    await vi.advanceTimersByTimeAsync(500);

    expect(adapter.writeFile).toHaveBeenCalledTimes(1);
    expect(storageAutoSync.emitStorageAutoSyncEvent).toHaveBeenCalledWith({ kind: 'notes-starred' });
    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content)).toMatchObject({
      entries: [createEntry('2', 'note', 'C:/vault-a', 'second.md')],
    });
  });

  it('preserves entries added by another window during a stale save', async () => {
    const diskEntry = createEntry('disk', 'note', 'C:/vault-a', 'disk.md');
    const localEntry = createEntry('local', 'note', 'C:/vault-a', 'local.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/store/notes-starred.json');
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true, size: 200 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [diskEntry],
      deletedEntryKeys: [],
    }));
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([localEntry]);

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content).entries).toEqual([localEntry, diskEntry]);
  });

  it('does not resurrect explicitly removed entries while merging disk state', async () => {
    const removedEntry = createEntry('removed', 'note', 'C:/vault-a', 'removed.md');
    const localEntry = createEntry('local', 'note', 'C:/vault-a', 'local.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/store/notes-starred.json');
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true, size: 200 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [removedEntry],
      deletedEntryKeys: [],
    }));
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([localEntry], { deletedEntries: [removedEntry] });

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.entries).toEqual([localEntry]);
    expect(payload.deletedEntryKeys).toEqual(['note::C:/vault-a::removed.md']);
  });

  it('prunes invalid entries during load', async () => {
    const validEntry = createEntry('1', 'note', 'C:/vault-a', 'alive.md');
    const invalidEntry = createEntry('2', 'note', 'C:/vault-b', 'missing.md');

    adapter.exists.mockImplementation(async (path: string) => {
      return path === '/store/notes-starred.json' || path === 'C:/vault-a' || path === 'C:/vault-a/alive.md';
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === 'C:/vault-a') {
        return { isDirectory: true, isFile: false };
      }

      if (path === 'C:/vault-a/alive.md') {
        return { isDirectory: false, isFile: true };
      }

      return null;
    });
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        version: 1,
        entries: [validEntry, invalidEntry],
      })
    );
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([validEntry]);
    expect(adapter.writeFile).toHaveBeenCalledTimes(1);
    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content)).toMatchObject({ entries: [validEntry] });
  });

  it('drops non-markdown note entries while preserving folder entries', async () => {
    const validNote = createEntry('note', 'note', 'C:/vault-a', 'alive.mkd');
    const staleImageNote = createEntry('image', 'note', 'C:/vault-a', 'image.png');
    const pngNamedFolder = createEntry('folder', 'folder', 'C:/vault-a', 'assets.png');

    adapter.exists.mockImplementation(async (path: string) => {
      return (
        path === '/store/notes-starred.json' ||
        path === 'C:/vault-a' ||
        path === 'C:/vault-a/alive.mkd' ||
        path === 'C:/vault-a/assets.png'
      );
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === 'C:/vault-a') {
        return { isDirectory: true, isFile: false };
      }
      if (path === 'C:/vault-a/alive.mkd') {
        return { isDirectory: false, isFile: true };
      }
      if (path === 'C:/vault-a/assets.png') {
        return { isDirectory: true, isFile: false };
      }
      return null;
    });
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        version: 1,
        entries: [validNote, staleImageNote, pngNamedFolder],
      })
    );
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([validNote, pngNamedFolder]);
    expect(adapter.exists).not.toHaveBeenCalledWith('C:/vault-a/image.png');
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('drops traversal entries before checking targets on disk', async () => {
    adapter.exists.mockImplementation(async (path: string) => path === '/store/notes-starred.json');
    adapter.stat.mockResolvedValue(null);
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        version: 1,
        entries: [createEntry('1', 'note', 'C:/vault-a', '../secret.md')],
      })
    );

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([]);
    expect(adapter.exists).not.toHaveBeenCalledWith('C:/vault-a/../secret.md');
  });

  it('does not parse oversized starred registries', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockImplementation(async (path: string) => (
      path === '/store/notes-starred.json'
        ? { isDirectory: false, isFile: true, size: 6 * 1024 * 1024 }
        : null
    ));

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([]);
    expect(adapter.readFile).not.toHaveBeenCalled();
  });


  it('keeps entries when the target still exists but stat metadata is unavailable', async () => {
    const validEntry = createEntry('1', 'note', 'C:/vault-a', 'alive.md');

    adapter.exists.mockImplementation(async (path: string) => {
      return (
        path === '/store/notes-starred.json' ||
        path === 'C:/vault-a' ||
        path === 'C:/vault-a/alive.md'
      );
    });
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        version: 1,
        entries: [validEntry],
      })
    );
    adapter.stat.mockResolvedValue(null);

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([validEntry]);
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });
});
