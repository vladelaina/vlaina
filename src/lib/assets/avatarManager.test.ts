import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAvatarDownloadState,
  downloadAndSaveAvatar,
  getLocalAvatarUrl,
  MAX_PENDING_AVATAR_DOWNLOADS,
} from './avatarManager';

const hoisted = vi.hoisted(() => ({
  getBasePath: vi.fn(async () => '/app-data'),
  exists: vi.fn(async (_path: string) => true),
  mkdir: vi.fn(async () => undefined),
  stat: vi.fn(async (_path: string): Promise<{
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    modifiedAt: number;
  } | null> => null),
  writeBinaryFile: vi.fn(async () => undefined),
  loadImageAsBase64: vi.fn(async () => 'data:image/png;base64,LOCAL'),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    getBasePath: hoisted.getBasePath,
    exists: hoisted.exists,
    mkdir: hoisted.mkdir,
    stat: hoisted.stat,
    writeBinaryFile: hoisted.writeBinaryFile,
  }),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

vi.mock('./io/reader', () => ({
  loadImageAsBase64: hoisted.loadImageAsBase64,
}));

describe('avatarManager request cleanup', () => {
  afterEach(() => {
    clearAvatarDownloadState();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    hoisted.getBasePath.mockResolvedValue('/app-data');
    hoisted.exists.mockResolvedValue(true);
    hoisted.mkdir.mockResolvedValue(undefined);
    hoisted.stat.mockResolvedValue(null);
    hoisted.writeBinaryFile.mockResolvedValue(undefined);
    hoisted.loadImageAsBase64.mockResolvedValue('data:image/png;base64,LOCAL');
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
      expect(init?.credentials).toBe('omit');
      expect(init?.referrerPolicy).toBe('no-referrer');
      return new Promise(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = downloadAndSaveAvatar('https://example.com/hangs-fetch.png', 'fetch-hangs');

    await vi.advanceTimersByTimeAsync(8000);

    await expect(request).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds concurrent avatar downloads for different users', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);

    const requests = Array.from({ length: MAX_PENDING_AVATAR_DOWNLOADS }, (_value, index) =>
      downloadAndSaveAvatar(
        `https://example.com/avatar-${index}.png`,
        `pending-user-${index}`,
      )
    );

    expect(fetchMock).toHaveBeenCalledTimes(MAX_PENDING_AVATAR_DOWNLOADS);
    await expect(
      downloadAndSaveAvatar('https://example.com/avatar-overflow.png', 'pending-overflow')
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(MAX_PENDING_AVATAR_DOWNLOADS);

    await vi.advanceTimersByTimeAsync(8000);
    await expect(Promise.all(requests)).resolves.toEqual(
      Array.from({ length: MAX_PENDING_AVATAR_DOWNLOADS }, () => null)
    );
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

  it('does not request local-network avatar URLs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadAndSaveAvatar('http://127.0.0.1:3000/avatar.png', 'local-user')).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(hoisted.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('does not save non-image avatar responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      blob: async () => new Blob(['<script></script>'], { type: 'text/html' }),
    })));

    await expect(downloadAndSaveAvatar('https://example.com/avatar.html', 'html-user')).resolves.toBeNull();

    expect(hoisted.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('does not save oversized avatar responses from content-length', async () => {
    const blob = vi.fn(async () => new Blob(['image'], { type: 'image/png' }));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: new Headers({
        'content-length': String(11 * 1024 * 1024),
        'content-type': 'image/png',
      }),
      blob,
    })));

    await expect(downloadAndSaveAvatar('https://example.com/huge.png', 'huge-user')).resolves.toBeNull();

    expect(blob).not.toHaveBeenCalled();
    expect(hoisted.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('stops reading streamed avatar responses once they exceed the size limit', async () => {
    const cancel = vi.fn(async () => undefined);
    const reader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(10 * 1024 * 1024) })
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(1) }),
      cancel,
      releaseLock: vi.fn(),
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      body: {
        getReader: () => reader,
      },
      blob: vi.fn(),
    })));

    await expect(downloadAndSaveAvatar('https://example.com/stream.png', 'stream-user')).resolves.toBeNull();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
    expect(hoisted.writeBinaryFile).not.toHaveBeenCalled();
  });

  it('saves supported avatar images with an extension matching the response MIME type', async () => {
    const avatarBlob = {
      type: 'image/webp',
      size: 3,
      arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    };
    const blob = vi.fn(async () => avatarBlob);
    const fetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'image/webp', 'content-length': '3' }),
      blob,
    }));
    vi.stubGlobal('fetch', fetch);

    const result = await downloadAndSaveAvatar('https://example.com/avatar.webp', 'octocat');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(blob).toHaveBeenCalledTimes(1);
    expect(avatarBlob.arrayBuffer).toHaveBeenCalledTimes(1);
    expect(hoisted.writeBinaryFile).toHaveBeenCalledWith(
      '/app-data/.vlaina/system/avatar_octocat.webp',
      new Uint8Array([1, 2, 3]),
      { recursive: true },
    );
    expect(result).toBe('/app-data/.vlaina/system/avatar_octocat.webp');
  });

  it('loads the newest cached local avatar while preserving png compatibility', async () => {
    hoisted.exists.mockImplementation(async (path: string) => path.endsWith('.png') || path.endsWith('.webp'));
    hoisted.stat.mockImplementation(async (path: string) => ({
      name: path.split('/').pop() || '',
      path,
      isDirectory: false,
      isFile: true,
      modifiedAt: path.endsWith('.webp') ? 20 : 10,
    }));
    hoisted.loadImageAsBase64.mockResolvedValueOnce('data:image/webp;base64,LOCAL');

    await expect(getLocalAvatarUrl('octocat')).resolves.toBe('data:image/webp;base64,LOCAL');

    expect(hoisted.loadImageAsBase64).toHaveBeenCalledWith('/app-data/.vlaina/system/avatar_octocat.webp');
  });

  it('ignores invalid local avatar modified times when selecting the newest cache file', async () => {
    hoisted.exists.mockImplementation(async (path: string) => path.endsWith('.png') || path.endsWith('.webp'));
    hoisted.stat.mockImplementation(async (path: string) => ({
      name: path.split('/').pop() || '',
      path,
      isDirectory: false,
      isFile: true,
      modifiedAt: path.endsWith('.png') ? Number.POSITIVE_INFINITY : 10,
    }));
    hoisted.loadImageAsBase64.mockResolvedValueOnce('data:image/webp;base64,LOCAL');

    await expect(getLocalAvatarUrl('octocat')).resolves.toBe('data:image/webp;base64,LOCAL');

    expect(hoisted.loadImageAsBase64).toHaveBeenCalledWith('/app-data/.vlaina/system/avatar_octocat.webp');
  });
});
