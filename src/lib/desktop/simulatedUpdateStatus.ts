import { APP_VERSION } from '@/lib/appVersion';
import type { DesktopUpdateInfo } from './updateStatus';

export function createSimulatedDesktopUpdateInfo(): DesktopUpdateInfo {
  return {
    currentVersion: APP_VERSION,
    latestVersion: '99.99.99',
    updateAvailable: true,
    downloadUrl: 'https://github.com/vladelaina/vlaina/releases/latest',
    releaseUrl: 'https://github.com/vladelaina/vlaina/releases/latest',
    platformAssetName: 'vlaina-simulated-update',
    platformAssetSha256: '',
    hasPlatformAsset: true,
    releaseNotes: 'Simulated desktop update for local preview.',
    publishedAt: new Date().toISOString(),
    simulated: true,
    downloadState: 'downloaded',
    downloadedFilePath: '',
    downloadedFileName: 'vlaina-simulated-update',
    downloadedAt: new Date().toISOString(),
    updatePolicy: {
      distribution: 'direct',
      checkEnabled: true,
      backgroundDownloadEnabled: false,
      localInstallerEnabled: false,
      externalDownloadEnabled: true,
      cleanupDownloadedUpdatesEnabled: true,
    },
  };
}
