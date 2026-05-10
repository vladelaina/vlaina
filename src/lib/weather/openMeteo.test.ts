import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWeather, searchCity } from './openMeteo';

describe('openMeteo request cleanup', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clears the geocoding timeout when fetch fails before the timeout fires', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    await expect(searchCity('Shanghai')).resolves.toEqual([]);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the weather timeout when fetch fails before the timeout fires', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    await expect(getWeather(31.2, 121.5)).resolves.toBeNull();

    expect(vi.getTimerCount()).toBe(0);
  });
});
