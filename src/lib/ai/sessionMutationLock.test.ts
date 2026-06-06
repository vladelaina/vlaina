import { afterEach, describe, expect, it, vi } from 'vitest';
import { aliasSessionId, clearSessionIdAliases } from './sessionIdAliases';
import { runWithSessionMutationLock, runWithSessionMutationLocks } from './sessionMutationLock';

async function waitForBroadcastHandler(
  getHandler: () => ((event: { data: unknown }) => void) | null,
): Promise<(event: { data: unknown }) => void> {
  await vi.waitFor(() => {
    expect(getHandler()).toBeTypeOf('function');
  });
  return getHandler()!;
}

describe('sessionMutationLock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('ignores oversized localStorage lock records instead of parsing them', async () => {
    localStorage.setItem('vlaina-session-mutation-lock:session-1', 'x'.repeat(8 * 1024 + 1));
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

  it('ignores malformed BroadcastChannel lock changes while waiting', async () => {
    vi.resetModules();
    let onmessage: ((event: { data: unknown }) => void) | null = null;
    vi.stubGlobal('BroadcastChannel', class {
      set onmessage(value: ((event: { data: unknown }) => void) | null) {
        onmessage = value;
      }

      postMessage() {}
      close() {}
    });
    const { runWithSessionMutationLock: runFreshLock } = await import('./sessionMutationLock');
    const task = vi.fn(() => 'ok');

    localStorage.setItem('vlaina-session-mutation-lock:session-1', JSON.stringify({
      ownerId: 'other-window',
      token: 'other-token',
      expiresAt: Date.now() + 15000,
    }));
    const pending = runFreshLock('session-1', task);
    const handleMessage = await waitForBroadcastHandler(() => onmessage);

    handleMessage({ data: { sessionId: '../session-1', sourceId: 'other-window', nonce: 'ok' } });
    handleMessage({ data: { sessionId: 'session-1', sourceId: 'other-window', nonce: 'x'.repeat(513) } });
    await Promise.resolve();
    await Promise.resolve();
    expect(task).not.toHaveBeenCalled();

    localStorage.removeItem('vlaina-session-mutation-lock:session-1');
    handleMessage({ data: { sessionId: 'session-1', sourceId: 'other-window', nonce: 'ok' } });

    await expect(pending).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('ignores self-emitted BroadcastChannel lock changes while waiting', async () => {
    vi.resetModules();
    let onmessage: ((event: { data: unknown }) => void) | null = null;
    let lastPosted: unknown = null;
    vi.stubGlobal('BroadcastChannel', class {
      set onmessage(value: ((event: { data: unknown }) => void) | null) {
        onmessage = value;
      }

      postMessage(message: unknown) {
        lastPosted = message;
      }

      close() {}
    });
    const { runWithSessionMutationLock: runFreshLock } = await import('./sessionMutationLock');

    await runFreshLock('session-1', () => 'seed');
    expect(lastPosted).toEqual(expect.objectContaining({ sessionId: 'session-1' }));

    const task = vi.fn(() => 'ok');
    localStorage.setItem('vlaina-session-mutation-lock:session-1', JSON.stringify({
      ownerId: 'other-window',
      token: 'other-token',
      expiresAt: Date.now() + 15000,
    }));
    const pending = runFreshLock('session-1', task);
    const handleMessage = await waitForBroadcastHandler(() => onmessage);

    handleMessage({ data: lastPosted });
    await Promise.resolve();
    await Promise.resolve();
    expect(task).not.toHaveBeenCalled();

    localStorage.removeItem('vlaina-session-mutation-lock:session-1');
    handleMessage({ data: { sessionId: 'session-1', sourceId: 'other-window', nonce: 'ok' } });

    await expect(pending).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
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
