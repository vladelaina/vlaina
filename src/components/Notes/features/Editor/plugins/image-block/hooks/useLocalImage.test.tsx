import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalImage } from './useLocalImage';
import { clearRemoteImageMemoryCacheForTests } from '../utils/remoteImageMemoryCache';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
}));

vi.mock('@/lib/storage/adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/adapter')>()),
  getStorageAdapter: () => ({
    exists: hoisted.exists,
  }),
}));

describe('useLocalImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRemoteImageMemoryCacheForTests();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:remote-image'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-length': '12' }),
      blob: async () => new Blob(['remote image'], { type: 'image/png' }),
    })));
  });

  it('does not try to resolve relative paths while the vault path is temporarily empty', async () => {
    const { result } = renderHook(() =>
      useLocalImage('assets/2026-03-31_16-08-49.png', '', undefined)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('assets/2026-03-31_16-08-49.png');
    expect(result.current.error).toBeNull();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('does not browser-load unsafe local fallbacks while the vault path is temporarily empty', async () => {
    const internal = renderHook(() =>
      useLocalImage('.vlaina/assets/secret.png', '', undefined)
    );
    const git = renderHook(() =>
      useLocalImage('docs/.git/secret.png', '', undefined)
    );
    const traversal = renderHook(() =>
      useLocalImage('../secret.png', '', undefined)
    );
    const userDotFolder = renderHook(() =>
      useLocalImage('.notes/public.png', '', undefined)
    );

    await waitFor(() => {
      expect(internal.result.current.isLoading).toBe(false);
      expect(git.result.current.isLoading).toBe(false);
      expect(traversal.result.current.isLoading).toBe(false);
      expect(userDotFolder.result.current.isLoading).toBe(false);
    });

    expect(internal.result.current.resolvedSrc).toBe('');
    expect(git.result.current.resolvedSrc).toBe('');
    expect(traversal.result.current.resolvedSrc).toBe('');
    expect(userDotFolder.result.current.resolvedSrc).toBe('.notes/public.png');
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('falls back to the vault-root image path when the note-relative path is missing', async () => {
    hoisted.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    hoisted.loadImageAsBlob.mockResolvedValueOnce('blob:vault-root-image');

    const { result } = renderHook(() =>
      useLocalImage('assets/demo.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('blob:vault-root-image');
    expect(result.current.error).toBeNull();
    expect(hoisted.exists).toHaveBeenNthCalledWith(1, '/vault/daily/assets/demo.png');
    expect(hoisted.exists).toHaveBeenNthCalledWith(2, '/vault/assets/demo.png');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/vault/assets/demo.png');
  });

  it('loads local image files without treating query params as part of the filename', async () => {
    hoisted.loadImageAsBlob.mockResolvedValueOnce('blob:local-image');

    const { result } = renderHook(() =>
      useLocalImage('./assets/demo.png?cache=1#preview', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('blob:local-image');
    expect(result.current.error).toBeNull();
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/vault/daily/assets/demo.png');
  });

  it('loads internal img asset refs through contained local paths', async () => {
    hoisted.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    hoisted.loadImageAsBlob.mockResolvedValueOnce('blob:internal-image');

    const { result } = renderHook(() =>
      useLocalImage('img:assets/demo.png?cache=1#preview', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('blob:internal-image');
    expect(result.current.error).toBeNull();
    expect(hoisted.exists).toHaveBeenNthCalledWith(1, '/vault/daily/assets/demo.png');
    expect(hoisted.exists).toHaveBeenNthCalledWith(2, '/vault/assets/demo.png');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/vault/assets/demo.png');
  });

  it('does not render note-controlled unsupported media schemes', async () => {
    const { result } = renderHook(() =>
      useLocalImage('asset://localhost/secret.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('');
    expect(result.current.error).toBeNull();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('does not read invalid internal img asset refs', async () => {
    const { result } = renderHook(() =>
      useLocalImage('img:/vault/assets/demo.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('');
    expect(result.current.error).toBeNull();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('does not fall back to browser-loading internal local paths', async () => {
    const { result } = renderHook(() =>
      useLocalImage('.vlaina/assets/secret.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('');
    expect(result.current.error?.message).toBe('Failed to resolve image: .vlaina/assets/secret.png');
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('does not fall back to browser-loading unresolved local paths once a vault is available', async () => {
    const { result } = renderHook(() =>
      useLocalImage('../../secret.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('');
    expect(result.current.error?.message).toBe('Failed to resolve image: ../../secret.png');
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('does not fall back to browser-loading local paths when file reads fail', async () => {
    hoisted.loadImageAsBlob.mockRejectedValueOnce(new Error('Missing image'));

    const { result } = renderHook(() =>
      useLocalImage('./assets/missing.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('');
    expect(result.current.error?.message).toBe('Missing image');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/vault/daily/assets/missing.png');
  });

  it('renders safe raster data image sources after normalizing their prefix', async () => {
    const { result } = renderHook(() =>
      useLocalImage('DATA:IMAGE/WEBP;BASE64,AQI=', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('data:image/webp;base64,AQI=');
    expect(result.current.error).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('renders sanitized public remote images without resolving them through local storage', async () => {
    const { result } = renderHook(() =>
      useLocalImage('https://example.com/tracker.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('blob:remote-image');
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://example.com/tracker.png', { cache: 'force-cache' });
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('normalizes protocol-relative public remote images before fetching', async () => {
    const { result } = renderHook(() =>
      useLocalImage('//example.com/tracker.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('blob:remote-image');
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://example.com/tracker.png', { cache: 'force-cache' });
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('does not fetch or read images while loading is deferred', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useLocalImage('https://example.com/deferred.png', '/vault', 'daily/demo.md', enabled),
      { initialProps: { enabled: false } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('');
    expect(fetch).not.toHaveBeenCalled();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.resolvedSrc).toBe('blob:remote-image');
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not read local images while loading is deferred', async () => {
    const { result } = renderHook(() =>
      useLocalImage('assets/demo.png', '/vault', 'daily/demo.md', false)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('');
    expect(hoisted.exists).not.toHaveBeenCalled();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('reuses a cached remote image blob for repeated remote image opens', async () => {
    const first = renderHook(() =>
      useLocalImage('https://example.com/tracker.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
    });

    const second = renderHook(() =>
      useLocalImage('https://example.com/tracker.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(second.result.current.isLoading).toBe(false);
    });

    expect(first.result.current.resolvedSrc).toBe('blob:remote-image');
    expect(second.result.current.resolvedSrc).toBe('blob:remote-image');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original remote URL instead of caching oversized remote images', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-length': String(9 * 1024 * 1024) }),
      body: { cancel: vi.fn(async () => undefined) },
      blob: vi.fn(),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useLocalImage('https://example.com/large.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('https://example.com/large.png');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
