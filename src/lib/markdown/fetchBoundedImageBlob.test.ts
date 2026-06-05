import { describe, expect, it, vi } from 'vitest';
import { MAX_FETCHED_IMAGE_BYTES, readBoundedImageBlobResponse } from './fetchBoundedImageBlob';

describe('fetchBoundedImageBlob', () => {
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
});
