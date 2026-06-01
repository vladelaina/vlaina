import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHydrateAvatar } from './avatarActions';
import { refreshAvatar } from './authSupport';

vi.mock('@/lib/assets/avatarManager', () => ({
  getLocalAvatarUrl: vi.fn(),
  downloadAndSaveAvatar: vi.fn(),
}));

const { getLocalAvatarUrl, downloadAndSaveAvatar } = vi.mocked(await import('@/lib/assets/avatarManager'));

describe('accountSession avatar actions', () => {
  beforeEach(() => {
    getLocalAvatarUrl.mockReset();
    downloadAndSaveAvatar.mockReset();
  });

  it('clears stale local avatar when no cached file exists for the current user', async () => {
    const set = vi.fn();
    const get = vi.fn(() => ({ username: 'next-user' }));
    getLocalAvatarUrl.mockResolvedValueOnce(null);

    await refreshAvatar(set as never, get as never, 'next-user', null);

    expect(set).toHaveBeenCalledWith({ localAvatarUrl: null });
  });

  it('does not write a stale refreshed avatar after the account changes', async () => {
    const set = vi.fn();
    const state = { username: 'old-user' };
    const get = vi.fn(() => state);
    let resolveLocalAvatar!: (value: string | null) => void;
    getLocalAvatarUrl.mockReturnValueOnce(new Promise((resolve) => {
      resolveLocalAvatar = resolve;
    }));

    const refresh = refreshAvatar(set as never, get as never, 'old-user', null);
    state.username = 'next-user';
    resolveLocalAvatar('local-old-avatar');
    await refresh;

    expect(set).not.toHaveBeenCalled();
  });

  it('hydrateAvatar clears stale local avatar when the signed-in user has no cached avatar', async () => {
    const set = vi.fn();
    const get = vi.fn(() => ({ username: 'next-user' }));
    getLocalAvatarUrl.mockResolvedValueOnce(null);

    await createHydrateAvatar(set as never, get as never)();

    expect(set).toHaveBeenCalledWith({ localAvatarUrl: null });
  });

  it('does not write a stale hydrated avatar after the account changes', async () => {
    const set = vi.fn();
    const state = { username: 'old-user' };
    const get = vi.fn(() => state);
    let resolveLocalAvatar!: (value: string | null) => void;
    getLocalAvatarUrl.mockReturnValueOnce(new Promise((resolve) => {
      resolveLocalAvatar = resolve;
    }));

    const hydrate = createHydrateAvatar(set as never, get as never)();
    state.username = 'next-user';
    resolveLocalAvatar('local-old-avatar');
    await hydrate;

    expect(set).not.toHaveBeenCalled();
  });
});
