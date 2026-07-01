import { afterEach, describe, expect, it, vi } from 'vitest';
import { UPDATE_INFO_CACHE_KEY, type DesktopUpdateInfo } from './updateStatus';
import { startDesktopUpdateDownload } from './updateDownload';

function createUpdateInfo(overrides: Partial<DesktopUpdateInfo> = {}): DesktopUpdateInfo {
  return {
    currentVersion: '0.1.16',
    latestVersion: '0.1.17',
    updateAvailable: true,
    downloadUrl: 'https://github.com/vladelaina/vlaina/releases/download/v0.1.17/vlaina-0.1.17-linux-x86_64.AppImage',
    releaseUrl: 'https://github.com/vladelaina/vlaina/releases/tag/v0.1.17',
    platformAssetName: 'vlaina-0.1.17-linux-x86_64.AppImage',
    hasPlatformAsset: true,
    releaseNotes: '',
    publishedAt: '',
    ...overrides,
  };
}

describe('desktop update background download policy', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not start a background download when distribution policy disables it', () => {
    const updateApi = {
      check: vi.fn(),
      getPolicy: vi.fn(),
      download: vi.fn(),
      openDownloaded: vi.fn(),
      deleteDownloaded: vi.fn(),
    };

    startDesktopUpdateDownload(updateApi, createUpdateInfo({
      updatePolicy: {
        distribution: 'microsoft-store',
        checkEnabled: false,
        backgroundDownloadEnabled: false,
        localInstallerEnabled: false,
        externalDownloadEnabled: false,
        cleanupDownloadedUpdatesEnabled: true,
      },
    }));

    expect(updateApi.download).not.toHaveBeenCalled();
    expect(localStorage.getItem(UPDATE_INFO_CACHE_KEY)).toBeNull();
  });

  it('does not start a background download when the update asset has no sha256', () => {
    const updateApi = {
      check: vi.fn(),
      getPolicy: vi.fn(),
      download: vi.fn(),
      openDownloaded: vi.fn(),
      deleteDownloaded: vi.fn(),
    };

    startDesktopUpdateDownload(updateApi, createUpdateInfo());

    expect(updateApi.download).not.toHaveBeenCalled();
    expect(localStorage.getItem(UPDATE_INFO_CACHE_KEY)).toBeNull();
  });
});
