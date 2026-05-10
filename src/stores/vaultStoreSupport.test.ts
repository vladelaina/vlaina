import { afterEach, describe, expect, it, vi } from 'vitest';

describe('vaultStoreSupport broadcast channel guards', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not throw when BroadcastChannel construction fails', async () => {
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('broadcast unavailable');
      }
    });
    const { setupBroadcastChannel } = await import('./vaultStoreSupport');

    expect(() => setupBroadcastChannel()).not.toThrow();
  });

  it('resolves vault-open queries when BroadcastChannel postMessage fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage() {
        throw new Error('post failed');
      }
      close() {}
    });
    const { queryVaultOpenInOtherWindow } = await import('./vaultStoreSupport');

    const query = queryVaultOpenInOtherWindow('/vault');
    await vi.advanceTimersByTimeAsync(200);

    await expect(query).resolves.toBeNull();
  });
});
