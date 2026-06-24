import { describe, expect, it, vi } from 'vitest';
import { once } from './AppContentModules';

describe('AppContentModules once', () => {
  it('retries the factory after a rejected preload promise', async () => {
    const firstError = new Error('chunk load failed');
    const factory = vi.fn<() => Promise<{ value: string }>>()
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce({ value: 'loaded' });
    const preload = once(factory);

    await expect(preload()).rejects.toThrow(firstError);
    await expect(preload()).resolves.toEqual({ value: 'loaded' });
    await expect(preload()).resolves.toEqual({ value: 'loaded' });

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
