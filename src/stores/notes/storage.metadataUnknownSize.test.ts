import { beforeEach, describe, expect, it, vi } from 'vitest';

const MAX_METADATA_READ_BYTES = 5 * 1024 * 1024;

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  getBasePath: vi.fn<() => Promise<string>>(),
  listDir: vi.fn<(path: string, options?: { includeHidden?: boolean }) => Promise<Array<{
    name: string;
    isDirectory?: boolean;
    isFile?: boolean;
  }>>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{
    isDirectory?: boolean;
    isFile?: boolean;
    modifiedAt?: number | null;
    size?: number | null;
  } | null>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

import { loadNoteMetadata, loadWorkspaceState } from './storage';

describe('notes metadata unknown-size files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.exists.mockResolvedValue(false);
    adapter.getBasePath.mockResolvedValue('/app');
    adapter.listDir.mockResolvedValue([{ name: 'alpha.md', isFile: true }]);
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_icon: "💡"',
      '---',
      '',
      '# Alpha',
    ].join('\n'));
  });

  it('reads markdown metadata when file stat omits size', async () => {
    adapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 7 });

    await expect(loadNoteMetadata('/notes-root-unknown-size')).resolves.toEqual({
      version: 2,
      notes: {
        'alpha.md': { icon: '💡', updatedAt: 7 },
      },
    });
    expect(adapter.readFile).toHaveBeenCalledWith('/notes-root-unknown-size/alpha.md', MAX_METADATA_READ_BYTES);
  });

  it('reads workspace state with bounded reads when stat omits size', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 7 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      currentNotePath: 'alpha.md',
      expandedFolders: ['docs'],
    }));

    const state = await loadWorkspaceState('/notes-root-workspace-unknown-size');

    expect(adapter.readFile).toHaveBeenCalledWith(
      expect.stringContaining('/workspace.json'),
      256 * 1024,
    );
    expect(state).toEqual({
      currentNotePath: 'alpha.md',
      expandedFolders: ['docs'],
      fileTreeSortMode: undefined,
    });
  });
});
