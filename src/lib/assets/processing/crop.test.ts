import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCroppedImg } from './crop';

describe('image crop loading', () => {
  const originalImage = globalThis.Image;

  afterEach(() => {
    vi.useRealTimers();
    globalThis.Image = originalImage;
  });

  it('rejects after a bounded wait when image loading stalls', async () => {
    vi.useFakeTimers();
    class MockImage {
      private listeners = new Map<string, EventListener>();
      src = '';

      addEventListener(type: string, listener: EventListener) {
        this.listeners.set(type, listener);
      }

      removeEventListener(type: string, listener: EventListener) {
        if (this.listeners.get(type) === listener) {
          this.listeners.delete(type);
        }
      }

      setAttribute() {}
    }
    globalThis.Image = MockImage as unknown as typeof Image;
    const cropPromise = getCroppedImg('blob:stalled-image', { x: 0, y: 0, width: 10, height: 10 });
    const rejection = expect(cropPromise).rejects.toThrow('Image load timed out');

    await vi.advanceTimersByTimeAsync(20);

    await rejection;
  });
});
