import { readBoundedJsonResponse } from './boundedJsonResponse.mjs';
import { compareVersions, fetchUpdateManifest as fetchDesktopUpdateManifest } from './updateManifest.mjs';
import { deleteDownloadedUpdate, downloadUpdateAsset, normalizeDownloadedUpdateForOpen } from './updateDownload.mjs';
import { resolveDesktopUpdatePolicy } from './updatePolicy.mjs';

const updateManifestUrl = (
  process.env.APP_UPDATE_MANIFEST_URL
  ?? 'https://vlaina.com/api/update/latest'
).trim();
const defaultDownloadUrl = (
  process.env.APP_DOWNLOAD_URL
  ?? 'https://vlaina.com/download'
).trim();
const updateManifestRetryDelaysMs = [300, 1000];

export function registerDesktopUpdateIpc({
  app,
  fetchImpl,
  handleIpc,
  shell,
}) {
  const desktopUpdatePolicy = resolveDesktopUpdatePolicy();
  let updateDownloadJob = null;

  async function fetchUpdateManifest() {
    return fetchDesktopUpdateManifest({
      manifestUrl: updateManifestUrl,
      defaultDownloadUrl,
      appVersion: app.getVersion(),
      readJsonResponse: readBoundedJsonResponse,
      allowLocalManifestUrl: !app.isPackaged,
      retryDelaysMs: updateManifestRetryDelaysMs,
    });
  }

  handleIpc('desktop:update:check', async () => {
    const currentVersion = app.getVersion();
    if (!desktopUpdatePolicy.checkEnabled) {
      return {
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        downloadUrl: '',
        releaseUrl: '',
        platformAssetName: '',
        platformAssetSha256: '',
        hasPlatformAsset: false,
        releaseNotes: '',
        publishedAt: '',
        updatePolicy: desktopUpdatePolicy,
      };
    }

    const manifest = await fetchUpdateManifest();

    return {
      currentVersion,
      ...manifest,
      updateAvailable: compareVersions(manifest.latestVersion, currentVersion) > 0,
      updatePolicy: desktopUpdatePolicy,
    };
  });

  handleIpc('desktop:update:get-policy', async () => desktopUpdatePolicy);

  handleIpc('desktop:update:download', async (_event, updateInfo) => {
    if (!desktopUpdatePolicy.backgroundDownloadEnabled) {
      throw new Error('Background update downloads are disabled for this distribution.');
    }
    if (!updateInfo?.hasPlatformAsset) {
      throw new Error('No platform update asset is available.');
    }
    if (!updateInfo?.platformAssetSha256) {
      throw new Error('Update asset SHA-256 is required.');
    }
    if (compareVersions(updateInfo.latestVersion, app.getVersion()) <= 0) {
      throw new Error('Update version is not newer than the current app version.');
    }

    const downloadKey = [
      updateInfo?.latestVersion,
      updateInfo?.platformAssetName,
      updateInfo?.platformAssetSha256,
      updateInfo?.downloadUrl,
    ].join('\n');

    if (updateDownloadJob) {
      if (updateDownloadJob.key === downloadKey) {
        return await updateDownloadJob.promise;
      }
      updateDownloadJob.controller.abort();
      await updateDownloadJob.promise.catch(() => {
      });
    }

    const controller = new AbortController();
    const promise = downloadUpdateAsset({
      app,
      updateInfo,
      fetchImpl,
      signal: controller.signal,
    });
    updateDownloadJob = { key: downloadKey, promise, controller };

    try {
      return await promise;
    } finally {
      if (updateDownloadJob?.promise === promise) {
        updateDownloadJob = null;
      }
    }
  });

  handleIpc('desktop:update:open-downloaded', async (_event, updateInfo) => {
    if (!desktopUpdatePolicy.localInstallerEnabled) {
      throw new Error('Opening downloaded update installers is disabled for this distribution.');
    }

    const normalizedPath = await normalizeDownloadedUpdateForOpen(app, updateInfo);
    const result = await shell.openPath(normalizedPath);
    if (result) {
      throw new Error(result);
    }
  });

  handleIpc('desktop:update:delete-downloaded', async (_event, updateInfoOrFilePath) => {
    if (!desktopUpdatePolicy.cleanupDownloadedUpdatesEnabled) {
      return;
    }
    deleteDownloadedUpdate(app, updateInfoOrFilePath);
  });
}
