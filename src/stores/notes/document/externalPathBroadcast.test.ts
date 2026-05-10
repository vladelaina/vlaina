import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitNotesExternalPathRename,
  readNotesExternalPathEvents,
  subscribeNotesExternalPathRename,
} from './externalPathBroadcast';

const adapter = {
  readFile: vi.fn<(path: string) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ size?: number } | null>>(),
  writeFile: vi.fn<(path: string, content: string, options?: { recursive?: boolean }) => Promise<void>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

vi.mock('@/lib/storage/paths', () => ({
  getPaths: () => Promise.resolve({ store: '/store' }),
}));

describe('external path broadcast persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.stat.mockResolvedValue(null);
    adapter.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores oversized event files before reading them', async () => {
    adapter.stat.mockResolvedValue({ size: 300 * 1024 });

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([]);

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('loads only valid bounded rename events', async () => {
    adapter.readFile.mockResolvedValue(JSON.stringify([
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n1',
        stamp: 1,
        notesPath: '/vault',
        oldPath: 'docs/a.md',
        newPath: 'docs/b.md',
      },
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n2',
        stamp: Number.POSITIVE_INFINITY,
        notesPath: '/vault',
        oldPath: 'docs/c.md',
        newPath: 'docs/d.md',
      },
    ]));

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([
      expect.objectContaining({
        nonce: 'n1',
        oldPath: 'docs/a.md',
        newPath: 'docs/b.md',
      }),
    ]);
  });

  it('does not throw when BroadcastChannel construction fails', () => {
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('broadcast unavailable');
      }
    });

    expect(() => {
      const unsubscribe = subscribeNotesExternalPathRename('/vault', vi.fn());
      unsubscribe();
    }).not.toThrow();
  });

  it('continues emitting rename events when BroadcastChannel postMessage fails', () => {
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage() {
        throw new Error('post failed');
      }
      close() {}
    });

    expect(() => emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: 'docs/a.md',
      newPath: 'docs/b.md',
    })).not.toThrow();

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toContain('docs/b.md');
  });

  it('isolates external path rename listener failures', () => {
    const first = vi.fn(() => {
      throw new Error('listener failed');
    });
    const second = vi.fn();
    const unsubscribeFirst = subscribeNotesExternalPathRename('/vault', first);
    const unsubscribeSecond = subscribeNotesExternalPathRename('/vault', second);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-notes-external-path-event',
      newValue: JSON.stringify({
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n1',
        stamp: Date.now(),
        notesPath: '/vault',
        oldPath: 'docs/a.md',
        newPath: 'docs/b.md',
      }),
    }));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });
});
