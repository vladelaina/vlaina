import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarredEntry } from '../types';

const MAX_STARRED_REGISTRY_BYTES = 5 * 1024 * 1024;

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
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
  normalizeAbsolutePath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const driveMatch = normalized.match(/^([A-Za-z]:)(?:\/|$)/);
    const root = driveMatch ? `${driveMatch[1]}/` : normalized.startsWith('/') ? '/' : '';
    if (!root) return path;

    const parts: string[] = [];
    for (const part of normalized.slice(root.length).split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }

    const nextPath = `${root}${parts.join('/')}`.replace(/\/+$/, '');
    return nextPath || root;
  },
}));

vi.mock('@/lib/storage/paths', () => ({
  ensureDirectories: () => Promise.resolve(),
  getPaths: () => Promise.resolve({ notes: '/app/.vlaina/notes' }),
}));

vi.mock('@/lib/storage/storageAutoSync', () => ({
  emitStorageAutoSyncEvent: storageAutoSync.emitStorageAutoSyncEvent,
}));

function createEntry(
  id: string,
  kind: 'note' | 'folder',
  notesRootPath: string,
  relativePath: string
): StarredEntry {
  return {
    id,
    kind,
    notesRootPath,
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
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('coalesces queued starred writes', async () => {
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([createEntry('1', 'note', 'C:/notes-root-a', 'first.md')]);
    persistence.saveStarredRegistry([createEntry('2', 'note', 'C:/notes-root-a', 'second.md')]);

    await vi.advanceTimersByTimeAsync(500);

    expect(adapter.writeFile).toHaveBeenCalledTimes(1);
    expect(storageAutoSync.emitStorageAutoSyncEvent).toHaveBeenCalledWith({ kind: 'notes-starred' });
    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content)).toMatchObject({
      entries: [createEntry('2', 'note', 'C:/notes-root-a', 'second.md')],
    });
  });

  it('preserves entries added by another window during a stale save', async () => {
    const diskEntry = createEntry('disk', 'note', 'C:/notes-root-a', 'disk.md');
    const localEntry = createEntry('local', 'note', 'C:/notes-root-a', 'local.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
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

  it('preserves entries from an unknown-size registry during a stale save', async () => {
    const diskEntry = createEntry('disk', 'note', 'C:/notes-root-a', 'disk.md');
    const localEntry = createEntry('local', 'note', 'C:/notes-root-a', 'local.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [diskEntry],
      deletedEntryKeys: [],
    }));
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([localEntry]);

    await vi.advanceTimersByTimeAsync(500);

    expect(adapter.readFile).toHaveBeenCalledWith('/app/.vlaina/notes/starred.json', MAX_STARRED_REGISTRY_BYTES);
    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content).entries).toEqual([localEntry, diskEntry]);
  });

  it('does not resurrect explicitly removed entries while merging disk state', async () => {
    const removedEntry = createEntry('removed', 'note', 'C:/notes-root-a', 'removed.md');
    const localEntry = createEntry('local', 'note', 'C:/notes-root-a', 'local.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
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
    expect(payload.deletedEntryKeys).toEqual(['note::c:/notes-root-a::removed.md']);
  });

  it('normalizes deleted entry tombstones while merging disk state', async () => {
    const localEntry = createEntry('local', 'note', 'C:/notes-root-a', 'local.md');
    const diskEntry = createEntry('disk', 'note', 'C:/notes-root-a', 'disk.md');
    const removedEntry = createEntry('removed', 'note', 'C:/notes-root-a', 'removed.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true, size: 200 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [diskEntry],
      deletedEntryKeys: [
        'note::C:/notes-root-a::disk.md',
        'note::C:/notes-root-a::disk.md',
        'folder::C:/notes-root-a::assets',
        'bad-key',
        'note::missing-target',
        'note::C:/notes-root-a::evil\u202E.md',
        'note::C:/notes-root-a::' + 'a'.repeat(4097),
      ],
    }));
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([localEntry, diskEntry], { deletedEntries: [removedEntry] });

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.entries).toEqual([localEntry]);
    expect(payload.deletedEntryKeys).toEqual([
      'note::c:/notes-root-a::removed.md',
      'note::c:/notes-root-a::disk.md',
      'folder::c:/notes-root-a::assets',
    ]);
  });

  it('normalizes deleted entry tombstone opened folder paths before filtering merged entries', async () => {
    const diskEntry = createEntry('disk', 'note', 'C:/notes-root-a/docs/..', 'removed.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true, size: 200 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [diskEntry],
      deletedEntryKeys: ['note::C:/notes-root-a::removed.md'],
    }));
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([]);

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.entries).toEqual([]);
    expect(payload.deletedEntryKeys).toEqual(['note::c:/notes-root-a::removed.md']);
  });

  it('matches Windows deleted entry tombstones case-insensitively', async () => {
    const diskEntry = createEntry('disk', 'note', 'C:/Users/Me/NotesRoot', 'removed.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true, size: 200 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [diskEntry],
      deletedEntryKeys: ['note::c:/users/me/notesRoot::removed.md'],
    }));
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([]);

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.entries).toEqual([]);
    expect(payload.deletedEntryKeys).toEqual(['note::c:/users/me/notesroot::removed.md']);
  });

  it('bounds deleted entry tombstone scans while merging disk state', async () => {
    const localEntry = createEntry('local', 'note', 'C:/notes-root-a', 'local.md');
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true, size: 200 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [],
      deletedEntryKeys: [
        ...Array.from({ length: 20_000 }, () => 'bad-key'),
        'note::C:/notes-root-a::late.md',
      ],
    }));
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([localEntry]);

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.entries).toEqual([localEntry]);
    expect(payload.deletedEntryKeys).toEqual([]);
  });

  it('filters invalid entries before saving', async () => {
    const validEntry = createEntry('local', 'note', 'C:/notes-root-a', 'local.md');
    adapter.exists.mockResolvedValue(false);
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([
      validEntry,
      createEntry('app-note', 'note', 'C:/notes-root-a', '.vlaina/workspace.md'),
      createEntry('git-folder', 'folder', 'C:/notes-root-a', 'docs/.GIT'),
      createEntry('image-note', 'note', 'C:/notes-root-a', 'image.png'),
    ], {
      deletedEntries: [
        createEntry('removed', 'note', 'C:/notes-root-a', 'removed.md'),
        createEntry('internal-removed', 'note', 'C:/notes-root-a', '.git/config.md'),
      ],
    });

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    const payload = JSON.parse(content);
    expect(payload.entries).toEqual([validEntry]);
    expect(payload.deletedEntryKeys).toEqual(['note::c:/notes-root-a::removed.md']);
  });

  it('defers pruning invalid entries until after load', async () => {
    const validEntry = createEntry('1', 'note', 'C:/notes-root-a', 'alive.md');
    const invalidEntry = createEntry('2', 'note', 'C:/notes-root-b', 'missing.md');

    adapter.exists.mockImplementation(async (path: string) => {
      return path === '/app/.vlaina/notes/starred.json' || path === 'C:/notes-root-a' || path === 'C:/notes-root-a/alive.md';
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/notes/starred.json') {
        return { isDirectory: false, isFile: true, size: 200 };
      }

      if (path === 'C:/notes-root-a') {
        return { isDirectory: true, isFile: false };
      }

      if (path === 'C:/notes-root-a/alive.md') {
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

    expect(result.entries).toEqual([validEntry, invalidEntry]);
    expect(adapter.writeFile).not.toHaveBeenCalled();
    expect(adapter.exists).not.toHaveBeenCalledWith('C:/notes-root-b');

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(adapter.writeFile).toHaveBeenCalledTimes(1));

    expect(adapter.writeFile).toHaveBeenCalledTimes(1);
    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content)).toMatchObject({ entries: [validEntry] });
  });

  it('drops non-markdown note entries while preserving folder entries', async () => {
    const validNote = createEntry('note', 'note', 'C:/notes-root-a', 'alive.mkd');
    const staleImageNote = createEntry('image', 'note', 'C:/notes-root-a', 'image.png');
    const pngNamedFolder = createEntry('folder', 'folder', 'C:/notes-root-a', 'assets.png');

    adapter.exists.mockImplementation(async (path: string) => {
      return (
        path === '/app/.vlaina/notes/starred.json' ||
        path === 'C:/notes-root-a' ||
        path === 'C:/notes-root-a/alive.mkd' ||
        path === 'C:/notes-root-a/assets.png'
      );
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/notes/starred.json') {
        return { isDirectory: false, isFile: true, size: 200 };
      }

      if (path === 'C:/notes-root-a') {
        return { isDirectory: true, isFile: false };
      }
      if (path === 'C:/notes-root-a/alive.mkd') {
        return { isDirectory: false, isFile: true };
      }
      if (path === 'C:/notes-root-a/assets.png') {
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
    expect(adapter.exists).not.toHaveBeenCalledWith('C:/notes-root-a/image.png');
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('drops traversal entries before checking targets on disk', async () => {
    adapter.exists.mockImplementation(async (path: string) => path === '/app/.vlaina/notes/starred.json');
    adapter.stat.mockResolvedValue(null);
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        version: 1,
        entries: [createEntry('1', 'note', 'C:/notes-root-a', '../secret.md')],
      })
    );

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([]);
    expect(adapter.exists).not.toHaveBeenCalledWith('C:/notes-root-a/../secret.md');
  });

  it('does not spend the starred load entry budget on invalid entries before valid markdown entries', async () => {
    const validEntry = createEntry('valid', 'note', 'C:/notes-root-a', 'alive.md');

    adapter.exists.mockImplementation(async (path: string) => {
      return (
        path === '/app/.vlaina/notes/starred.json' ||
        path === 'C:/notes-root-a' ||
        path === 'C:/notes-root-a/alive.md'
      );
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/notes/starred.json') {
        return { isDirectory: false, isFile: true, size: 400_000 };
      }
      if (path === 'C:/notes-root-a') {
        return { isDirectory: true, isFile: false };
      }
      if (path === 'C:/notes-root-a/alive.md') {
        return { isDirectory: false, isFile: true };
      }
      return null;
    });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [
        ...Array.from({ length: 5000 }, (_, index) =>
          createEntry(`image-${index}`, 'note', 'C:/notes-root-a', `image-${index}.png`)
        ),
        validEntry,
      ],
    }));

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([validEntry]);
    expect(adapter.exists).not.toHaveBeenCalledWith('C:/notes-root-a/alive.md');
  });

  it('does not parse oversized starred registries', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockImplementation(async (path: string) => (
      path === '/app/.vlaina/notes/starred.json'
        ? { isDirectory: false, isFile: true, size: 6 * 1024 * 1024 }
        : null
    ));

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([]);
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not parse starred registries with invalid known stat sizes', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockImplementation(async (path: string) => (
      path === '/app/.vlaina/notes/starred.json'
        ? { isDirectory: false, isFile: true, size: -1 }
        : null
    ));

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([]);
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('loads starred registries when stat has no size', async () => {
    const validEntry = createEntry('1', 'note', 'C:/notes-root-a', 'alive.md');
    adapter.exists.mockImplementation(async (path: string) => {
      return (
        path === '/app/.vlaina/notes/starred.json' ||
        path === 'C:/notes-root-a' ||
        path === 'C:/notes-root-a/alive.md'
      );
    });
    adapter.stat.mockImplementation(async (path: string) => {
      if (path === '/app/.vlaina/notes/starred.json') {
        return { isDirectory: false, isFile: true };
      }
      if (path === 'C:/notes-root-a') {
        return { isDirectory: true, isFile: false };
      }
      if (path === 'C:/notes-root-a/alive.md') {
        return { isDirectory: false, isFile: true };
      }
      return null;
    });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      entries: [validEntry],
    }));

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([validEntry]);
    expect(adapter.readFile).toHaveBeenCalledWith('/app/.vlaina/notes/starred.json', MAX_STARRED_REGISTRY_BYTES);
  });

  it('does not parse starred registry content that exceeds the limit after read', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ isDirectory: false, isFile: true, size: 200 });
    adapter.readFile.mockResolvedValue('你'.repeat(Math.floor(MAX_STARRED_REGISTRY_BYTES / 3) + 1));

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([]);
    expect(adapter.readFile).toHaveBeenCalledWith('/app/.vlaina/notes/starred.json', MAX_STARRED_REGISTRY_BYTES);
  });

  it('keeps entries when the target still exists but stat metadata is unavailable', async () => {
    const validEntry = createEntry('1', 'note', 'C:/notes-root-a', 'alive.md');

    adapter.exists.mockImplementation(async (path: string) => {
      return (
        path === '/app/.vlaina/notes/starred.json' ||
        path === 'C:/notes-root-a' ||
        path === 'C:/notes-root-a/alive.md'
      );
    });
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        version: 1,
        entries: [validEntry],
      })
    );
    adapter.stat.mockImplementation(async (path: string) => (
      path === '/app/.vlaina/notes/starred.json'
        ? { isDirectory: false, isFile: true, size: 200 }
        : null
    ));

    const persistence = await import('./persistence');
    const result = await persistence.loadStarredRegistry();

    expect(result.entries).toEqual([validEntry]);
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('does not spend the starred save entry budget on invalid entries before valid markdown entries', async () => {
    const validEntry = createEntry('valid', 'note', 'C:/notes-root-a', 'alive.md');
    adapter.exists.mockResolvedValue(false);
    adapter.writeFile.mockResolvedValue();

    const persistence = await import('./persistence');
    persistence.saveStarredRegistry([
      ...Array.from({ length: 5000 }, (_, index) =>
        createEntry(`image-${index}`, 'note', 'C:/notes-root-a', `image-${index}.png`)
      ),
      validEntry,
    ]);

    await vi.advanceTimersByTimeAsync(500);

    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content).entries).toEqual([validEntry]);
  });
});
