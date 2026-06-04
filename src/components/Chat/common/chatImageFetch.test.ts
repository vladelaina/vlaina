import { describe, expect, it, vi } from 'vitest';
import { fetchChatImageBlob, MAX_CHAT_IMAGE_FETCH_BYTES } from './chatImageFetch';

describe('chatImageFetch', () => {
  it('rejects oversized image responses from content-length before reading the body', async () => {
    const blob = vi.fn(async () => new Blob(['x'], { type: 'image/png' }));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      headers: new Headers({
        'content-length': String(MAX_CHAT_IMAGE_FETCH_BYTES + 1),
        'content-type': 'image/png',
      }),
      blob,
    })));

    await expect(fetchChatImageBlob('https://example.com/large.png')).resolves.toBeNull();

    expect(blob).not.toHaveBeenCalled();
  });

  it('stops reading streamed image responses once they exceed the size limit', async () => {
    const cancel = vi.fn(async () => undefined);
    const reader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(MAX_CHAT_IMAGE_FETCH_BYTES) })
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(1) }),
      cancel,
      releaseLock: vi.fn(),
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      headers: new Headers({ 'content-type': 'image/png' }),
      body: {
        getReader: () => reader,
      },
    })));

    await expect(fetchChatImageBlob('https://example.com/stream.png')).resolves.toBeNull();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('returns in-limit streamed image blobs', async () => {
    const reader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
        .mockResolvedValueOnce({ done: true }),
      cancel: vi.fn(),
      releaseLock: vi.fn(),
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      headers: new Headers({ 'content-type': 'image/png' }),
      body: {
        getReader: () => reader,
      },
    })));

    const blob = await fetchChatImageBlob('https://example.com/small.png');

    expect(blob).not.toBeNull();
    expect(blob?.type).toBe('image/png');
    expect(blob?.size).toBe(3);
    expect(reader.cancel).not.toHaveBeenCalled();
  });
});
