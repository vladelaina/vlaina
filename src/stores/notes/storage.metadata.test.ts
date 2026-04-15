import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadNoteMetadata, setNoteEntry } from './storage';
import type { MetadataFile } from './types';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

describe('notes metadata storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('migrates legacy flat cover fields into the normalized cover object', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.readFile.mockResolvedValue(JSON.stringify({
      version: 1,
      defaultIconSize: 64,
      notes: {
        'alpha.md': {
          cover: 'covers/alpha.webp',
          coverX: 12,
          coverY: 24,
          coverH: 260,
          coverScale: 1.4,
        },
      },
    }));

    await expect(loadNoteMetadata('/vault-a')).resolves.toEqual({
      version: 2,
      defaultIconSize: 64,
      notes: {
        'alpha.md': {
          cover: {
            assetPath: 'covers/alpha.webp',
            positionX: 12,
            positionY: 24,
            height: 260,
            scale: 1.4,
          },
        },
      },
    });
  });

  it('drops empty cover payloads when updating metadata', () => {
    const metadata: MetadataFile = {
      version: 2,
      notes: {
        'alpha.md': {
          cover: {
            assetPath: 'covers/alpha.webp',
            positionX: 50,
            positionY: 50,
          },
        },
      },
    };

    expect(setNoteEntry(metadata, 'alpha.md', { cover: undefined })).toEqual({
      version: 2,
      notes: {},
    });
  });
});
