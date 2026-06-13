import { describe, expect, it, vi } from 'vitest';
import { fetchBoundedImageBlobResult, MAX_FETCHED_IMAGE_BYTES, readBoundedImageBlobResponse } from './fetchBoundedImageBlob';

describe('fetchBoundedImageBlob', () => {
  function createSmallImageResponse(): Response {
    return {
      headers: new Headers({
        'content-length': '3',
        'content-type': 'image/png',
      }),
      blob: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })),
    } as unknown as Response;
  }

  it('fetches images without credentials or referrer by default', async () => {
    const fetchMock = vi.fn(async () => createSmallImageResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBoundedImageBlobResult('https://example.com/image.png')).resolves.toMatchObject({
      status: 'ok',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/image.png', {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    });
  });

  it('preserves safe fetch options while overriding credential, referrer, and redirect policy', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => createSmallImageResponse());
    vi.stubGlobal('fetch', fetchMock);

    await fetchBoundedImageBlobResult('https://example.com/image.png', {
      signal: controller.signal,
      fetchInit: {
        cache: 'force-cache',
        credentials: 'include',
        referrerPolicy: 'unsafe-url',
        redirect: 'follow',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/image.png', {
      cache: 'force-cache',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      signal: controller.signal,
    });
  });

  it('rejects unknown-size non-streaming responses before reading blob data', async () => {
    const blob = vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));

    await expect(readBoundedImageBlobResponse({
      headers: new Headers({ 'content-type': 'image/png' }),
      blob,
    } as unknown as Response)).resolves.toEqual({
      status: 'too-large',
      blob: null,
    });

    expect(blob).not.toHaveBeenCalled();
  });

  it('allows in-limit non-streaming responses with a trusted content length', async () => {
    const blob = vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));

    const result = await readBoundedImageBlobResponse({
      headers: new Headers({
        'content-length': '3',
        'content-type': 'image/png',
      }),
      blob,
    } as unknown as Response);

    expect(result.status).toBe('ok');
    expect(result.blob?.size).toBe(3);
    expect(blob).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized non-streaming responses when blob size exceeds the declared length', async () => {
    const blob = vi.fn(async () => new Blob([new Uint8Array(MAX_FETCHED_IMAGE_BYTES + 1)], { type: 'image/png' }));

    await expect(readBoundedImageBlobResponse({
      headers: new Headers({
        'content-length': '3',
        'content-type': 'image/png',
      }),
      blob,
    } as unknown as Response)).resolves.toEqual({
      status: 'too-large',
      blob: null,
    });
  });

  it('rejects non-streaming responses with invalid blob sizes', async () => {
    const blob = vi.fn(async () => ({
      type: 'image/png',
      size: -1,
      arrayBuffer: vi.fn(),
    } as unknown as Blob));

    await expect(readBoundedImageBlobResponse({
      headers: new Headers({
        'content-length': '3',
        'content-type': 'image/png',
      }),
      blob,
    } as unknown as Response)).resolves.toEqual({
      status: 'too-large',
      blob: null,
    });
  });

  it('cancels pending streamed reads when the signal aborts', async () => {
    const controller = new AbortController();
    const cancel = vi.fn(async () => undefined);
    const releaseLock = vi.fn();
    const reader = {
      read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined)),
      cancel,
      releaseLock,
    };

    const pending = readBoundedImageBlobResponse({
      headers: new Headers({ 'content-type': 'image/png' }),
      body: {
        getReader: () => reader,
      },
    } as unknown as Response, {
      signal: controller.signal,
    });

    expect(reader.read).toHaveBeenCalledTimes(1);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });
});
