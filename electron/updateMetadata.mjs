import fs from 'node:fs';
import path from 'node:path';
import { normalizeHttpUrl } from './externalUrlPolicy.mjs';
import { getUpdateDownloadTarget, requireUpdateAssetSha256 } from './updateDownloadPaths.mjs';

const metadataFileName = '.trusted-update.json';
const maxMetadataBytes = 4096;

function getMetadataPath(target) {
  return path.join(target.directoryPath, metadataFileName);
}

export function writeTrustedDownloadedUpdateMetadata(app, updateInfo) {
  const target = getUpdateDownloadTarget(app, updateInfo);
  const metadataPath = getMetadataPath(target);
  const temporaryPath = `${metadataPath}.tmp`;
  const metadata = {
    latestVersion: target.version,
    platformAssetName: target.assetName,
    platformAssetSha256: requireUpdateAssetSha256(updateInfo?.platformAssetSha256),
    downloadUrl: normalizeHttpUrl(updateInfo?.downloadUrl, 'Update download URL'),
  };

  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(metadata), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, metadataPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function readTrustedDownloadedUpdateMetadata(app, requestedUpdateInfo) {
  const target = getUpdateDownloadTarget(app, requestedUpdateInfo);
  const metadataPath = getMetadataPath(target);
  const stat = fs.statSync(metadataPath);
  if (!stat.isFile() || stat.size <= 0 || stat.size > maxMetadataBytes) {
    throw new Error('Trusted update metadata is invalid.');
  }

  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    throw new Error('Trusted update metadata is invalid.');
  }

  const latestVersion = String(metadata?.latestVersion ?? '');
  const platformAssetName = String(metadata?.platformAssetName ?? '');
  if (latestVersion !== target.version || platformAssetName !== target.assetName) {
    throw new Error('Trusted update metadata does not match the requested update.');
  }

  return {
    latestVersion,
    platformAssetName,
    platformAssetSha256: requireUpdateAssetSha256(metadata?.platformAssetSha256),
    downloadUrl: normalizeHttpUrl(metadata?.downloadUrl, 'Update download URL'),
    hasPlatformAsset: true,
  };
}
