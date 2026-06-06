import { afterEach, describe, expect, it, vi } from 'vitest';

describe('storageAutoSync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('does not throw when BroadcastChannel construction fails', async () => {
    vi.resetModules();
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('broadcast unavailable');
      }
    });

    const { emitStorageAutoSyncEvent, subscribeStorageAutoSync } = await import('./storageAutoSync');
    const listener = vi.fn();

    expect(() => {
      const unsubscribe = subscribeStorageAutoSync(listener);
      emitStorageAutoSyncEvent({ kind: 'chat-session', sessionId: 'session-1' });
      unsubscribe();
    }).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not throw when BroadcastChannel postMessage fails', async () => {
    vi.resetModules();
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((event: MessageEvent) => void) | null = null;

      postMessage() {
        throw new Error('post failed');
      }

      close() {}
    });

    const { emitStorageAutoSyncEvent } = await import('./storageAutoSync');

    expect(() => emitStorageAutoSyncEvent({ kind: 'unified' })).not.toThrow();
  });

  it('isolates storage sync listeners and ignores malformed events', async () => {
    vi.resetModules();
    const first = vi.fn(() => {
      throw new Error('listener failed');
    });
    const second = vi.fn();

    const { subscribeStorageAutoSync } = await import('./storageAutoSync');
    const unsubscribeFirst = subscribeStorageAutoSync(first);
    const unsubscribeSecond = subscribeStorageAutoSync(second);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-storage-sync-event',
      newValue: JSON.stringify({
        kind: 'unified',
        sourceId: 'other-window',
        stamp: Number.NaN,
        nonce: 'bad',
      }),
    }));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-storage-sync-event',
      newValue: 'x'.repeat(8 * 1024 + 1),
    }));
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-storage-sync-event',
      newValue: JSON.stringify({
        kind: 'ui-preferences',
        sourceId: 'other-window',
        stamp: Date.now(),
        nonce: 'ok',
      }),
    }));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('ignores oversized BroadcastChannel event fields', async () => {
    vi.resetModules();
    let onmessage: ((event: { data: unknown }) => void) | null = null;
    vi.stubGlobal('BroadcastChannel', class {
      set onmessage(value: ((event: { data: unknown }) => void) | null) {
        onmessage = value;
      }

      postMessage() {}
      close() {}
    });
    const listener = vi.fn();
    const { subscribeStorageAutoSync } = await import('./storageAutoSync');

    const unsubscribe = subscribeStorageAutoSync(listener);
    const handleMessage: ((event: { data: unknown }) => void) | null = onmessage;
    if (!handleMessage) {
      throw new Error('BroadcastChannel onmessage was not registered');
    }
    (handleMessage as (event: { data: unknown }) => void)({
      data: {
        kind: 'unified',
        sourceId: 'other-window',
        stamp: Date.now(),
        nonce: 'x'.repeat(4097),
      },
    });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('ignores unsafe chat session auto-sync events', async () => {
    vi.resetModules();
    let onmessage: ((event: { data: unknown }) => void) | null = null;
    vi.stubGlobal('BroadcastChannel', class {
      set onmessage(value: ((event: { data: unknown }) => void) | null) {
        onmessage = value;
      }

      postMessage() {}
      close() {}
    });

    const listener = vi.fn();
    const { subscribeStorageAutoSync } = await import('./storageAutoSync');
    const unsubscribe = subscribeStorageAutoSync(listener);
    const handleMessage: ((event: { data: unknown }) => void) | null = onmessage;
    if (!handleMessage) {
      throw new Error('BroadcastChannel onmessage was not registered');
    }

    (handleMessage as (event: { data: unknown }) => void)({
      data: {
        kind: 'chat-session',
        sourceId: 'other-window',
        stamp: Date.now(),
        nonce: 'ok',
        sessionId: '../unsafe',
      },
    });
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'vlaina-storage-sync-event',
      newValue: JSON.stringify({
        kind: 'chat-session',
        sourceId: 'other-window',
        stamp: Date.now(),
        nonce: 'ok',
        sessionId: 'bad/session',
      }),
    }));

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not emit unsafe chat session auto-sync events', async () => {
    vi.resetModules();
    const postedMessages: unknown[] = [];
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((event: MessageEvent) => void) | null = null;

      postMessage(value: unknown) {
        postedMessages.push(value);
      }

      close() {}
    });

    const { emitStorageAutoSyncEvent } = await import('./storageAutoSync');

    emitStorageAutoSyncEvent({ kind: 'chat-session', sessionId: '../unsafe' });

    expect(postedMessages).toEqual([]);
    expect(localStorage.getItem('vlaina-storage-sync-event')).toBeNull();

    emitStorageAutoSyncEvent({ kind: 'chat-session', sessionId: 'session_ok-1' });

    expect(postedMessages).toHaveLength(1);
    const stored = JSON.parse(localStorage.getItem('vlaina-storage-sync-event') || '{}') as { sessionId?: string };
    expect(stored.sessionId).toBe('session_ok-1');
  });
});
