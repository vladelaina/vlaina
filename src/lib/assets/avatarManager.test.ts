import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadAndSaveAvatar } from './avatarManager';

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    getBasePath: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    writeBinaryFile: vi.fn(),
  }),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

vi.mock('./io/reader', () => ({
  loadImageAsBase64: vi.fn(),
}));

describe('avatarManager request cleanup', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears the avatar download timeout when fetch fails before the timeout fires', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    await expect(downloadAndSaveAvatar('https://example.com/avatar.png', 'octocat')).resolves.toBeNull();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns null when fetch ignores the avatar timeout abort', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Promise(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = downloadAndSaveAvatar('https://example.com/hangs-fetch.png', 'fetch-hangs');

    await vi.advanceTimersByTimeAsync(8000);

    await expect(request).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns null when avatar blob reading ignores the timeout abort', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn(() => new Promise(() => undefined)),
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = downloadAndSaveAvatar('https://example.com/hangs-blob.png', 'blob-hangs');

    await vi.advanceTimersByTimeAsync(8000);

    await expect(request).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns null when avatar array buffer reading ignores the timeout abort', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn(() => new Promise(() => undefined)),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = downloadAndSaveAvatar('https://example.com/hangs-array-buffer.png', 'array-buffer-hangs');

    await vi.advanceTimersByTimeAsync(8000);

    await expect(request).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
