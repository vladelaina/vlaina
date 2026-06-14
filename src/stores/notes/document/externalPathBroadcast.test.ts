import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitNotesExternalPathRename,
  readNotesExternalPathEvents,
  subscribeNotesExternalPathRename,
} from './externalPathBroadcast';

const adapter = {
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ isDirectory?: boolean; isFile?: boolean; size?: number } | null>>(),
  writeFile: vi.fn<(path: string, content: string, options?: { recursive?: boolean }) => Promise<void>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:\//.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

vi.mock('@/lib/storage/paths', () => ({
  getPaths: () => Promise.resolve({ store: '/store' }),
}));

describe('external path broadcast persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    adapter.stat.mockResolvedValue(null);
    adapter.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not read missing event files after stat returns null', async () => {
    adapter.stat.mockResolvedValue(null);

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([]);

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('ignores oversized event files before reading them', async () => {
    adapter.stat.mockResolvedValue({ size: 300 * 1024 });

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([]);

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('ignores event files with invalid known stat sizes before reading them', async () => {
    adapter.stat.mockResolvedValue({ size: -1 });

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([]);

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('reads event files when stat has no size', async () => {
    adapter.stat.mockResolvedValue({});
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
    ]));

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([
      expect.objectContaining({
        nonce: 'n1',
        oldPath: 'docs/a.md',
        newPath: 'docs/b.md',
      }),
    ]);

    expect(adapter.readFile).toHaveBeenCalledWith(
      expect.stringContaining('/external-path-events.json'),
      256 * 1024,
    );
  });

  it('ignores event file content that exceeds the limit after read', async () => {
    adapter.stat.mockResolvedValue({ size: 256 });
    adapter.readFile.mockResolvedValue('x'.repeat(256 * 1024 + 1));

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([]);

    expect(adapter.readFile).toHaveBeenCalled();
  });

  it('loads only valid bounded rename events', async () => {
    adapter.stat.mockResolvedValue({ size: 256 });
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
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n3',
        stamp: 2,
        notesPath: '/vault',
        oldPath: '/tmp/a.md',
        newPath: 'docs/e.md',
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

  it('does not load stored rename events that target internal note folders', async () => {
    adapter.stat.mockResolvedValue({ size: 256 });
    adapter.readFile.mockResolvedValue(JSON.stringify([
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'internal-new',
        stamp: 1,
        notesPath: '/vault',
        oldPath: 'docs/a.md',
        newPath: 'docs/.git/config.md',
      },
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'internal-old',
        stamp: 2,
        notesPath: '/vault',
        oldPath: '.VLAINA/workspace.md',
        newPath: 'docs/b.md',
      },
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'user-dot-folder',
        stamp: 3,
        notesPath: '/vault',
        oldPath: '.notes/a.md',
        newPath: '.notes/b.md',
      },
    ]));

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([
      expect.objectContaining({
        nonce: 'user-dot-folder',
        oldPath: '.notes/a.md',
        newPath: '.notes/b.md',
      }),
    ]);
  });

  it('does not load stored rename events with URL-like paths', async () => {
    adapter.stat.mockResolvedValue({ size: 256 });
    adapter.readFile.mockResolvedValue(JSON.stringify([
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'url-new',
        stamp: 1,
        notesPath: '/vault',
        oldPath: 'docs/a.md',
        newPath: 'http://example.test/b.md',
      },
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'url-old',
        stamp: 2,
        notesPath: '/vault',
        oldPath: 'https\\://example.test/a.md',
        newPath: 'docs/b.md',
      },
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'valid',
        stamp: 3,
        notesPath: '/vault',
        oldPath: 'docs/c.md',
        newPath: 'docs/d.md',
      },
    ]));

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([
      expect.objectContaining({
        nonce: 'valid',
        oldPath: 'docs/c.md',
        newPath: 'docs/d.md',
      }),
    ]);
  });

  it('loads absolute rename events only when they stay inside the watched notes path', async () => {
    adapter.stat.mockResolvedValue({ size: 256 });
    adapter.readFile.mockResolvedValue(JSON.stringify([
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'absolute-valid',
        stamp: 1,
        notesPath: '/external/docs',
        oldPath: '/external/docs/current.md',
        newPath: '/external/docs/renamed.md',
      },
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'absolute-outside',
        stamp: 2,
        notesPath: '/external/docs',
        oldPath: '/external/other/current.md',
        newPath: '/external/other/renamed.md',
      },
    ]));

    await expect(readNotesExternalPathEvents('/external/docs')).resolves.toEqual([
      expect.objectContaining({
        nonce: 'absolute-valid',
        oldPath: '/external/docs/current.md',
        newPath: '/external/docs/renamed.md',
      }),
    ]);
  });

  it('normalizes stored rename event paths before replaying them', async () => {
    adapter.stat.mockResolvedValue({ size: 256 });
    adapter.readFile.mockResolvedValue(JSON.stringify([
      {
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n1',
        stamp: 1,
        notesPath: '/vault//',
        oldPath: './docs//a.md',
        newPath: 'docs\\b.md',
      },
    ]));

    await expect(readNotesExternalPathEvents('/vault')).resolves.toEqual([
      expect.objectContaining({
        notesPath: '/vault',
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

  it('does not persist overlong emitted rename events', () => {
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: 'docs/a.md',
      newPath: `${'x'.repeat(4097)}.md`,
    });

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toBeNull();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('does not persist unsafe emitted rename events', () => {
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: '/tmp/a.md',
      newPath: 'docs/b.md',
    });
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: 'docs/a.md',
      newPath: 'docs//a.md',
    });
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: 'docs/a.md',
      newPath: `docs/b\u0000.md`,
    });

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toBeNull();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('does not persist emitted rename events with URL-like paths', () => {
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: 'docs/a.md',
      newPath: 'http://example.test/b.md',
    });
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: 'https\\://example.test/a.md',
      newPath: 'docs/b.md',
    });

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toBeNull();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('persists emitted absolute rename events inside the watched notes path', () => {
    emitNotesExternalPathRename({
      notesPath: '/external/docs',
      oldPath: '/external/docs/current.md',
      newPath: '/external/docs/renamed.md',
    });

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toContain('/external/docs/renamed.md');
  });

  it('does not persist emitted absolute rename events outside the watched notes path', () => {
    emitNotesExternalPathRename({
      notesPath: '/external/docs',
      oldPath: '/external/other/current.md',
      newPath: '/external/other/renamed.md',
    });

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toBeNull();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('does not persist emitted rename events for internal note folders', () => {
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: 'docs/a.md',
      newPath: 'docs/.git/config.md',
    });
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: '.VLAINA/workspace.md',
      newPath: 'docs/b.md',
    });

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toBeNull();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('persists emitted rename events for user dot folders', () => {
    emitNotesExternalPathRename({
      notesPath: '/vault',
      oldPath: '.notes/a.md',
      newPath: '.notes/b.md',
    });

    expect(localStorage.getItem('vlaina-notes-external-path-event')).toContain('.notes/b.md');
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

  it('ignores unsafe storage rename events before notifying listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNotesExternalPathRename('/vault', listener);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-notes-external-path-event',
      newValue: JSON.stringify({
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n1',
        stamp: Date.now(),
        notesPath: '/vault',
        oldPath: '../secret.md',
        newPath: 'docs/b.md',
      }),
    }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('ignores URL-like storage rename events before notifying listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNotesExternalPathRename('/vault', listener);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-notes-external-path-event',
      newValue: JSON.stringify({
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n1',
        stamp: Date.now(),
        notesPath: '/vault',
        oldPath: 'docs/a.md',
        newPath: 'http://example.test/b.md',
      }),
    }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('ignores internal storage rename events before notifying listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNotesExternalPathRename('/vault', listener);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-notes-external-path-event',
      newValue: JSON.stringify({
        type: 'rename',
        sourceId: 'other-window',
        nonce: 'n1',
        stamp: Date.now(),
        notesPath: '/vault',
        oldPath: 'docs/a.md',
        newPath: 'docs/.GIT/config.md',
      }),
    }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
