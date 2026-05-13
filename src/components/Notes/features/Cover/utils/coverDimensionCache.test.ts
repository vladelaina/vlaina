import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadImageWithDimensions } from './coverDimensionCache';

describe('coverDimensionCache', () => {
  const originalImage = globalThis.Image;

  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  it('coalesces concurrent dimension loads for the same source', async () => {
    const instances: Array<{
      onload: (() => void) | null;
      onerror: (() => void) | null;
      naturalWidth: number;
      naturalHeight: number;
      src: string;
    }> = [];

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1600;
      naturalHeight = 900;
      src = '';

      constructor() {
        instances.push(this);
      }
    }

    globalThis.Image = MockImage as unknown as typeof Image;

    const firstLoad = loadImageWithDimensions('blob:cover');
    const secondLoad = loadImageWithDimensions('blob:cover');

    expect(instances).toHaveLength(1);
    instances[0].onload?.();

    await expect(firstLoad).resolves.toEqual({ width: 1600, height: 900 });
    await expect(secondLoad).resolves.toEqual({ width: 1600, height: 900 });
  });
});
