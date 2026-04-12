import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarredEntry } from '../types';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ isDirectory: boolean; isFile: boolean } | null>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

vi.mock('@/lib/storage/paths', () => ({
  ensureDirectories: () => Promise.resolve(),
  getPaths: () => Promise.resolve({ store: '/store' }),
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
    const [, content] = adapter.writeFile.mock.calls[0];
    expect(JSON.parse(content)).toMatchObject({
      entries: [createEntry('2', 'note', 'C:/vault-a', 'second.md')],
    });
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
