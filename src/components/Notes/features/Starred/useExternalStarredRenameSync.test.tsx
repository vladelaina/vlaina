import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExternalStarredRenameSync } from './useExternalStarredRenameSync';

type WatchEvent = {
  type: unknown;
  paths: string[];
};

const mocked = vi.hoisted(() => {
  const notesState = {
    starredEntries: [] as Array<{
      id: string;
      kind: 'note' | 'folder';
      vaultPath: string;
      relativePath: string;
      addedAt: number;
    }>,
    applyExternalPathRename: vi.fn(async () => undefined),
  };
  const vaultState = {
    currentVault: { path: '/vault-a' } as { path: string } | null,
  };
  return {
    notesState,
    vaultState,
    handlers: new Map<string, (event: WatchEvent) => void | Promise<void>>(),
    unwatch: vi.fn(async () => undefined),
    watchDesktopPath: vi.fn(async (path: string, handler: (event: WatchEvent) => void | Promise<void>) => {
      mocked.handlers.set(path, handler);
      return mocked.unwatch;
    }),
  };
});

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: mocked.watchDesktopPath,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getBaseName: (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? '',
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const index = normalized.lastIndexOf('/');
    return index > 0 ? normalized.slice(0, index) : null;
  },
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
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

    const nextPath = `${root}${parts.join('/')}`;
    return path.includes('\\') ? nextPath.replace(/\//g, '\\') : nextPath;
  },
  normalizePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/'),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof mocked.notesState) => unknown) => selector(mocked.notesState),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector: (state: typeof mocked.vaultState) => unknown) => selector(mocked.vaultState),
}));

describe('useExternalStarredRenameSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.handlers.clear();
    mocked.vaultState.currentVault = { path: '/vault-a' };
    mocked.notesState.starredEntries = [];
  });

  it('watches external starred notes and remaps renamed files', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    expect(mocked.watchDesktopPath).toHaveBeenCalledWith(
      '/vault-b/docs/alpha.md',
      expect.any(Function),
      { recursive: false },
    );

    await act(async () => {
      await mocked.handlers.get('/vault-b/docs/alpha.md')?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/vault-b/docs/alpha.md', '/vault-b/docs/beta.md'],
      });
    });

    expect(mocked.notesState.applyExternalPathRename).toHaveBeenCalledWith(
      '/vault-b/docs/alpha.md',
      '/vault-b/docs/beta.md',
    );
  });

  it('does not duplicate the current vault watcher for current-vault starred notes', () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-current',
        kind: 'note',
        vaultPath: '/vault-a',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    expect(mocked.watchDesktopPath).not.toHaveBeenCalled();
  });

  it('does not duplicate the current vault watcher for Windows case variants', () => {
    mocked.vaultState.currentVault = { path: 'c:\\users\\me\\vault' };
    mocked.notesState.starredEntries = [
      {
        id: 'starred-current-windows',
        kind: 'note',
        vaultPath: 'C:/Users/Me/Vault',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    expect(mocked.watchDesktopPath).not.toHaveBeenCalled();
  });

  it('remaps Windows external starred notes from case-varied rename events', async () => {
    mocked.vaultState.currentVault = { path: 'C:/Users/Me/Vault' };
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external-windows',
        kind: 'note',
        vaultPath: 'C:/Users/Me/Other',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    await act(async () => {
      await mocked.handlers.get('C:/Users/Me/Other/docs/alpha.md')?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: [
          'c:/users/me/other/docs/alpha.md',
          'c:/users/me/other/docs/beta.md',
        ],
      });
    });

    expect(mocked.notesState.applyExternalPathRename).toHaveBeenCalledWith(
      'c:/users/me/other/docs/alpha.md',
      'c:/users/me/other/docs/beta.md',
    );
  });

  it('does not remap external starred notes to non-Markdown paths', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    await act(async () => {
      await mocked.handlers.get('/vault-b/docs/alpha.md')?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/vault-b/docs/alpha.md', '/vault-b/docs/alpha.png'],
      });
    });

    expect(mocked.notesState.applyExternalPathRename).not.toHaveBeenCalled();
  });

  it('does not remap external starred notes through unsafe rename endpoints', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    await act(async () => {
      await mocked.handlers.get('/vault-b/docs/alpha.md')?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/vault-b/docs/alpha.md', '/vault-b/docs/secret\uFFFD.md'],
      });
    });

    expect(mocked.notesState.applyExternalPathRename).not.toHaveBeenCalled();
  });

  it('does not watch external starred notes inside internal folders', () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: '.git/config.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    expect(mocked.watchDesktopPath).not.toHaveBeenCalled();
  });

  it('does not remap external starred notes into internal folders', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    await act(async () => {
      await mocked.handlers.get('/vault-b/docs/alpha.md')?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/vault-b/docs/alpha.md', '/vault-b/docs/.vlaina/alpha.md'],
      });
    });

    expect(mocked.notesState.applyExternalPathRename).not.toHaveBeenCalled();
  });

  it('keeps external starred note rename sync inside user dot folders', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: '.notes/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    expect(mocked.watchDesktopPath).toHaveBeenCalledWith(
      '/vault-b/.notes/alpha.md',
      expect.any(Function),
      { recursive: false },
    );

    await act(async () => {
      await mocked.handlers.get('/vault-b/.notes/alpha.md')?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/vault-b/.notes/alpha.md', '/vault-b/.notes/beta.md'],
      });
    });

    expect(mocked.notesState.applyExternalPathRename).toHaveBeenCalledWith(
      '/vault-b/.notes/alpha.md',
      '/vault-b/.notes/beta.md',
    );
  });
});
