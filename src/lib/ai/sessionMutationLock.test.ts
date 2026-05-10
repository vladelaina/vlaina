import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWithSessionMutationLock, runWithSessionMutationLocks } from './sessionMutationLock';

describe('sessionMutationLock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('falls back to the in-memory queue when localStorage writes are unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const task = vi.fn(() => 'ok');

    await expect(runWithSessionMutationLock('session-1', task)).resolves.toBe('ok');

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('falls back to the in-memory queue when localStorage reads are unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const task = vi.fn(() => 'ok');

    await expect(runWithSessionMutationLock('session-1', task)).resolves.toBe('ok');

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('continues when BroadcastChannel is unavailable at runtime', async () => {
    const OriginalBroadcastChannel = globalThis.BroadcastChannel;
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('broadcast unavailable');
      }
    });
    const task = vi.fn(() => 'ok');

    await expect(runWithSessionMutationLock('session-1', task)).resolves.toBe('ok');

    expect(task).toHaveBeenCalledTimes(1);
    vi.stubGlobal('BroadcastChannel', OriginalBroadcastChannel);
  });

  it('ignores empty session ids when acquiring multiple locks', async () => {
    const task = vi.fn(() => 'ok');

    await expect(runWithSessionMutationLocks(['', '  ', 'session-1'], task)).resolves.toBe('ok');

    expect(task).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('vlaina-session-mutation-lock:')).toBeNull();
  });
});
