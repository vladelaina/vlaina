import { describe, expect, it, vi } from 'vitest';

import {
  registerExternalSyncWatcher,
  subscribeExternalSyncPause,
  suspendExternalSync,
} from './externalSyncControl';

describe('externalSyncControl', () => {
  it('isolates pause listeners and still resolves idle waiters', async () => {
    const throwingListener = vi.fn(() => {
      throw new Error('listener failed');
    });
    const healthyListener = vi.fn();
    const unsubscribeThrowing = subscribeExternalSyncPause(throwingListener);
    const unsubscribeHealthy = subscribeExternalSyncPause(healthyListener);
    const releaseWatcher = registerExternalSyncWatcher();

    const resumePromise = suspendExternalSync();
    await Promise.resolve();
    expect(healthyListener).toHaveBeenCalled();

    releaseWatcher();
    const resume = await resumePromise;
    resume();

    expect(throwingListener).toHaveBeenCalled();
    expect(healthyListener).toHaveBeenCalled();
    unsubscribeThrowing();
    unsubscribeHealthy();
  });
});
