import { afterEach, describe, expect, it, vi } from 'vitest';
import { aliasSessionId, clearSessionIdAliases } from './sessionIdAliases';
import { runWithSessionMutationLock, runWithSessionMutationLocks } from './sessionMutationLock';

describe('sessionMutationLock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearSessionIdAliases();
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

  it('serializes promoted session mutations with the still-running temporary session mutation', async () => {
    let temporaryMutationStarted!: () => void;
    let releaseTemporaryMutation!: () => void;
    const temporaryMutationStartedPromise = new Promise<void>((resolve) => {
      temporaryMutationStarted = resolve;
    });
    const temporaryMutationReleased = new Promise<void>((resolve) => {
      releaseTemporaryMutation = resolve;
    });
    const events: string[] = [];

    const temporaryMutation = runWithSessionMutationLock('temp-session-1', async () => {
      events.push('temp-start');
      temporaryMutationStarted();
      await temporaryMutationReleased;
      events.push('temp-end');
    });
    await temporaryMutationStartedPromise;

    aliasSessionId('temp-session-1', 'session-1');
    const promotedMutation = runWithSessionMutationLock('session-1', async () => {
      events.push('session-start');
    });
    await Promise.resolve();

    expect(events).toEqual(['temp-start']);

    releaseTemporaryMutation();
    await Promise.all([temporaryMutation, promotedMutation]);

    expect(events).toEqual(['temp-start', 'temp-end', 'session-start']);
  });
});
