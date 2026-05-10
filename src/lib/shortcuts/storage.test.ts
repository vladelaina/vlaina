import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetShortcuts } from './storage';

describe('shortcut storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when localStorage is unavailable during reset', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => resetShortcuts()).not.toThrow();
  });
});
