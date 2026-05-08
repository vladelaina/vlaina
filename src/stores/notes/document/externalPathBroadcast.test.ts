import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readNotesExternalPathEvents } from './externalPathBroadcast';

const adapter = {
  readFile: vi.fn<(path: string) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ size?: number } | null>>(),
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
});
