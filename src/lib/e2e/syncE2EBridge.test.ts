import { beforeEach, describe, expect, it } from 'vitest';
import { installSyncE2EBridge } from './syncE2EBridge';

describe('installSyncE2EBridge', () => {
  beforeEach(() => {
    delete window.__vlainaE2E;
    window.localStorage.removeItem('vlaina:e2e:enabled');
    window.history.replaceState(null, '', '/');
  });

  it('does not install the bridge when the e2e flag is absent', () => {
    installSyncE2EBridge();

    expect(window.__vlainaE2E).toBeUndefined();
  });
});
