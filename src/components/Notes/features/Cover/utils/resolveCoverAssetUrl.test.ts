import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCoverAssetUrlResolveCacheForTests,
  MAX_PENDING_COVER_ASSET_URL_RESOLVES,
  resolveCoverAssetUrl,
} from './resolveCoverAssetUrl';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  loadImageThumbnailAsBlob: vi.fn(),
  resolveExistingNotesRootAssetPath: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
  loadImageThumbnailAsBlob: hoisted.loadImageThumbnailAsBlob,
}));

vi.mock('@/lib/assets/core/paths', () => ({
  resolveExistingNotesRootAssetPath: hoisted.resolveExistingNotesRootAssetPath,
}));

describe('resolveCoverAssetUrl', () => {
  beforeEach(() => {
    clearCoverAssetUrlResolveCacheForTests();
    hoisted.loadImageAsBlob.mockReset();
    hoisted.loadImageThumbnailAsBlob.mockReset();
    hoisted.resolveExistingNotesRootAssetPath.mockReset();
  });

  it('rejects remote cover urls', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'https://example.com/cover.jpg',
      notesRootPath: '',
    })).rejects.toThrow('remote-cover-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'HTTPS://example.com/cover.jpg',
      notesRootPath: '',
    })).rejects.toThrow('remote-cover-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: '//example.com/cover.jpg',
      notesRootPath: '',
    })).rejects.toThrow('remote-cover-unsupported');
  });

  it('rejects unsafe persisted cover sources', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'blob:http://localhost/cover',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'BLOB:http://localhost/cover',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'javascript:alert(1)',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: '/etc/passwd',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    expect(hoisted.resolveExistingNotesRootAssetPath).not.toHaveBeenCalled();
  });

  it('rejects cover paths that point into internal notes folders', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: '.vlaina/assets/cover.webp',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'docs/.git/cover.webp',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: '%2evlaina/assets/cover.webp',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    await expect(resolveCoverAssetUrl({
      assetPath: 'docs%2f.git%2fcover.webp',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    expect(hoisted.resolveExistingNotesRootAssetPath).not.toHaveBeenCalled();
  });

  it('keeps user dot-folder cover paths resolvable', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/.notes/assets/cover.webp');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:user-dot');

    const url = await resolveCoverAssetUrl({
      assetPath: '.notes/assets/cover.webp',
      notesRootPath: '/notes-root-a',
    });

    expect(url).toBe('blob:user-dot');
    expect(hoisted.resolveExistingNotesRootAssetPath).toHaveBeenCalledWith(
      '/notes-root-a',
      '.notes/assets/cover.webp',
      undefined,
    );
  });

  it('does not resolve removed built-in cover aliases', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue(null);

    await expect(resolveCoverAssetUrl({
      assetPath: '@monet/2',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');
  });

  it('resolves local cover path against the notesRoot', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.webp');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:a');

    const url = await resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      notesRootPath: '/notes-root-a',
    });

    expect(url).toBe('blob:a');
    expect(hoisted.resolveExistingNotesRootAssetPath).toHaveBeenCalledWith('/notes-root-a', 'assets/a.webp', undefined);
  });

  it('reuses a completed resolve for repeated icon renders in one render window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/logo.png');
      hoisted.loadImageAsBlob.mockResolvedValue('blob:logo');

      const first = await resolveCoverAssetUrl({
        assetPath: 'assets/logo.png',
        notesRootPath: '/notes-root-a',
        currentNotePath: 'notes/today.md',
      });
      vi.advanceTimersByTime(250);
      const second = await resolveCoverAssetUrl({
        assetPath: 'assets/logo.png',
        notesRootPath: '/notes-root-a',
        currentNotePath: 'notes/today.md',
      });

      expect(first).toBe('blob:logo');
      expect(second).toBe('blob:logo');
      expect(hoisted.resolveExistingNotesRootAssetPath).toHaveBeenCalledTimes(1);
      expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(501);
      await expect(resolveCoverAssetUrl({
        assetPath: 'assets/logo.png',
        notesRootPath: '/notes-root-a',
        currentNotePath: 'notes/today.md',
      })).resolves.toBe('blob:logo');

      expect(hoisted.resolveExistingNotesRootAssetPath).toHaveBeenCalledTimes(2);
      expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reuses replay tokens for the same animated resource in one render window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.gif');
      hoisted.loadImageAsBlob.mockResolvedValue('blob:animated');

      const first = await resolveCoverAssetUrl({
        assetPath: 'assets/a.gif',
        notesRootPath: '/notes-root-a',
        replayAnimated: true,
      });
      const second = await resolveCoverAssetUrl({
        assetPath: './assets/a.gif',
        notesRootPath: '/notes-root-a',
        replayAnimated: true,
      });

      expect(first).toMatch(/^blob:animated#vlaina-replay=/);
      expect(second).toBe(first);

      vi.advanceTimersByTime(501);
      const later = await resolveCoverAssetUrl({
        assetPath: 'assets/a.gif',
        notesRootPath: '/notes-root-a',
        replayAnimated: true,
      });

      expect(later).toMatch(/^blob:animated#vlaina-replay=/);
      expect(later).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not add replay tokens to non-animated image assets', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.png');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:static');

    await expect(resolveCoverAssetUrl({
      assetPath: 'assets/a.png',
      notesRootPath: '/notes-root-a',
      replayAnimated: true,
    })).resolves.toBe('blob:static');
  });

  it('resolves note-relative cover paths against the current note', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/notes/assets/cover.webp');
    hoisted.loadImageAsBlob.mockResolvedValue('blob:relative');

    const url = await resolveCoverAssetUrl({
      assetPath: './assets/cover.webp',
      notesRootPath: '/notes-root-a',
      currentNotePath: 'notes/today.md',
    });

    expect(url).toBe('blob:relative');
    expect(hoisted.resolveExistingNotesRootAssetPath).toHaveBeenCalledWith('/notes-root-a', './assets/cover.webp', 'notes/today.md');
  });

  it('resolves local cover thumbnails without loading the full image blob', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.webp');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:thumb-a');

    const url = await resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      notesRootPath: '/notes-root-a',
      thumbnail: true,
    });

    expect(url).toBe('blob:thumb-a');
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledWith('/notesRoot/assets/a.webp');
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('disables main-thread thumbnail fallback for large cover thumbnails', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.webp');
    hoisted.loadImageThumbnailAsBlob.mockResolvedValue('blob:thumb-a');

    const url = await resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      notesRootPath: '/notes-root-a',
      thumbnail: true,
      thumbnailMaxEdgePx: 1280,
    });

    expect(url).toBe('blob:thumb-a');
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledWith('/notesRoot/assets/a.webp', {
      maxEdgePx: 1280,
      allowMainThreadFallback: false,
    });
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('coalesces concurrent resolves for the same cover', async () => {
    let resolveBlob: (url: string) => void = () => {
      throw new Error('blob load did not start');
    };
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/assets/a.webp');
    hoisted.loadImageAsBlob.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveBlob = resolve;
        })
    );

    const first = resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      notesRootPath: '/notes-root-a',
      currentNotePath: 'notes/today.md',
    });
    const second = resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      notesRootPath: '/notes-root-a',
      currentNotePath: 'notes/today.md',
    });

    await vi.waitFor(() => {
      expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
    });
    resolveBlob('blob:a');

    await expect(Promise.all([first, second])).resolves.toEqual(['blob:a', 'blob:a']);
    expect(hoisted.resolveExistingNotesRootAssetPath).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
  });

  it('bounds concurrent resolves for different covers', async () => {
    const pendingBlobResolves: Array<(url: string) => void> = [];
    hoisted.resolveExistingNotesRootAssetPath.mockImplementation(
      async (_notesRootPath: string, assetPath: string) => `/notesRoot/${assetPath}`
    );
    hoisted.loadImageAsBlob.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          pendingBlobResolves.push(resolve);
        })
    );

    const requests = Array.from(
      { length: MAX_PENDING_COVER_ASSET_URL_RESOLVES },
      (_value, index) => resolveCoverAssetUrl({
        assetPath: `assets/cover-${index}.webp`,
        notesRootPath: '/notes-root-a',
      }),
    );

    await vi.waitFor(() => {
      expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(MAX_PENDING_COVER_ASSET_URL_RESOLVES);
    });
    await expect(resolveCoverAssetUrl({
      assetPath: 'assets/overflow.webp',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-resolve-busy');
    expect(hoisted.resolveExistingNotesRootAssetPath).toHaveBeenCalledTimes(
      MAX_PENDING_COVER_ASSET_URL_RESOLVES
    );

    pendingBlobResolves.forEach((resolve, index) => resolve(`blob:${index}`));
    await expect(Promise.all(requests)).resolves.toHaveLength(MAX_PENDING_COVER_ASSET_URL_RESOLVES);
  });

  it('throws when local asset requires opened folder path', async () => {
    await expect(resolveCoverAssetUrl({
      assetPath: 'assets/a.webp',
      notesRootPath: '',
    })).rejects.toThrow('notes-root-path-required');
  });

  it('rejects unsupported absolute cover paths', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('');

    await expect(resolveCoverAssetUrl({
      assetPath: '/etc/passwd',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
    expect(hoisted.loadImageThumbnailAsBlob).not.toHaveBeenCalled();
  });

  it('does not read resolved cover paths inside internal notes folders', async () => {
    hoisted.resolveExistingNotesRootAssetPath.mockResolvedValue('/notesRoot/.vlaina/assets/cover.webp');

    await expect(resolveCoverAssetUrl({
      assetPath: 'assets/cover.webp',
      notesRootPath: '/notes-root-a',
    })).rejects.toThrow('cover-path-unsupported');

    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
    expect(hoisted.loadImageThumbnailAsBlob).not.toHaveBeenCalled();
  });
});
