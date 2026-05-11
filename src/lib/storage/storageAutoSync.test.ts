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
});
