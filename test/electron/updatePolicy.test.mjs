import { describe, expect, it } from 'vitest';
import { resolveDesktopUpdatePolicy } from '../../electron/updatePolicy.mjs';

describe('desktop update policy', () => {
  it('defaults to direct distribution updates', () => {
    expect(resolveDesktopUpdatePolicy({})).toEqual({
      distribution: 'direct',
      checkEnabled: true,
      backgroundDownloadEnabled: true,
      localInstallerEnabled: true,
      externalDownloadEnabled: true,
      cleanupDownloadedUpdatesEnabled: true,
    });
  });

  it('disables self update flows for Microsoft Store distribution', () => {
    expect(resolveDesktopUpdatePolicy({ APP_DISTRIBUTION_CHANNEL: 'ms-store' })).toEqual({
      distribution: 'microsoft-store',
      checkEnabled: false,
      backgroundDownloadEnabled: false,
      localInstallerEnabled: false,
      externalDownloadEnabled: false,
      cleanupDownloadedUpdatesEnabled: true,
    });
  });

  it('detects Microsoft Store distribution from the Electron runtime', () => {
    expect(resolveDesktopUpdatePolicy({}, { windowsStore: true })).toMatchObject({
      distribution: 'microsoft-store',
      checkEnabled: false,
      backgroundDownloadEnabled: false,
      localInstallerEnabled: false,
    });
  });
});
