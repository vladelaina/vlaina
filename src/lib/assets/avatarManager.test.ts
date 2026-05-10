import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadAndSaveAvatar } from './avatarManager';

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    getBasePath: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    writeBinaryFile: vi.fn(),
  }),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

vi.mock('./io/reader', () => ({
  loadImageAsBase64: vi.fn(),
}));

describe('avatarManager request cleanup', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears the avatar download timeout when fetch fails before the timeout fires', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    await expect(downloadAndSaveAvatar('https://example.com/avatar.png', 'octocat')).resolves.toBeNull();

    expect(vi.getTimerCount()).toBe(0);
  });
});
