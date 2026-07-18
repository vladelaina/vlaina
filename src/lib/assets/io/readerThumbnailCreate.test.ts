import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThumbnailBlobUrl } from './readerThumbnailCreate';

describe('thumbnail creation deadlines', () => {
  const originalImage = globalThis.Image;
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.Image = originalImage;
    globalThis.Worker = originalWorker;
  });

  it('terminates a stalled thumbnail worker and falls back to the source blob', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = terminate;
    }
    globalThis.Worker = MockWorker as unknown as typeof Worker;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumbnail-fallback');
    const thumbnailPromise = createThumbnailBlobUrl(
      '/notes/image.png',
      new Uint8Array([1, 2, 3]),
      'image/png',
      128,
      false,
    );

    await vi.advanceTimersByTimeAsync(20);

    await expect(thumbnailPromise).resolves.toBe('blob:thumbnail-fallback');
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('times out stalled main-thread image decoding and revokes the source URL', async () => {
    vi.useFakeTimers();
    globalThis.Worker = undefined as unknown as typeof Worker;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      src = '';
    }
    globalThis.Image = MockImage as unknown as typeof Image;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumbnail-source');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const thumbnailPromise = createThumbnailBlobUrl(
      '/notes/image.png',
      new Uint8Array([1, 2, 3]),
      'image/png',
      128,
      true,
    );
    const rejection = expect(thumbnailPromise).rejects.toThrow('Image thumbnail decode timed out');

    await vi.advanceTimersByTimeAsync(20);

    await rejection;
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:thumbnail-source');
  });
});
