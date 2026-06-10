import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCoverDimensionCache,
  loadImageWithDimensions,
  MAX_PENDING_COVER_DIMENSION_LOADS,
} from './coverDimensionCache';

describe('coverDimensionCache', () => {
  const originalImage = globalThis.Image;

  afterEach(() => {
    clearCoverDimensionCache();
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

  it('bounds concurrent dimension loads for different sources', async () => {
    const instances: Array<{
      onload: (() => void) | null;
      naturalWidth: number;
      naturalHeight: number;
      src: string;
    }> = [];

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1200;
      naturalHeight = 800;
      src = '';

      constructor() {
        instances.push(this);
      }
    }

    globalThis.Image = MockImage as unknown as typeof Image;

    const loads = Array.from({ length: MAX_PENDING_COVER_DIMENSION_LOADS }, (_value, index) =>
      loadImageWithDimensions(`blob:cover-${index}`)
    );

    expect(instances).toHaveLength(MAX_PENDING_COVER_DIMENSION_LOADS);
    await expect(loadImageWithDimensions('blob:overflow')).resolves.toBeNull();
    expect(instances).toHaveLength(MAX_PENDING_COVER_DIMENSION_LOADS);

    instances.forEach((instance) => instance.onload?.());
    await expect(Promise.all(loads)).resolves.toEqual(
      Array.from({ length: MAX_PENDING_COVER_DIMENSION_LOADS }, () => ({
        width: 1200,
        height: 800,
      }))
    );
  });
});
