import fs from 'node:fs';
import path from 'node:path';

const allowedUpdateAssetPattern = /^vlaina-[0-9A-Za-z._+-]+\.(?:exe|dmg|zip|AppImage|deb|tar\.gz)$/;
const allowedUpdateVersionPattern = /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/;

export function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

export function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function getUpdateDownloadRoot(app) {
  return path.join(app.getPath('userData'), 'update-downloads');
}

export function normalizeUpdateAssetName(rawName) {
  const raw = requireString(rawName, 'Update asset name');
  if (raw.includes('/') || raw.includes('\\')) {
    throw new Error('Update asset name is not allowed.');
  }
  const name = path.basename(raw);
  if (!allowedUpdateAssetPattern.test(name)) {
    throw new Error('Update asset name is not allowed.');
  }
  return name;
}

export function normalizeUpdateVersion(rawVersion) {
  const version = requireString(rawVersion, 'Update version').replace(/^v/i, '');
  if (!allowedUpdateVersionPattern.test(version)) {
    throw new Error('Update version is not allowed.');
  }
  return version;
}

function normalizeUpdateAssetSha256(rawSha256) {
  if (typeof rawSha256 !== 'string') return '';
  const sha256 = rawSha256.trim().toLowerCase().replace(/^sha256:/, '');
  if (!sha256) return '';
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Update asset SHA-256 is not allowed.');
  }
  return sha256;
}

export function requireUpdateAssetSha256(rawSha256) {
  const sha256 = normalizeUpdateAssetSha256(rawSha256);
  if (!sha256) {
    throw new Error('Update asset SHA-256 is required.');
  }
  return sha256;
}

export function getUpdateDownloadTarget(app, updateInfo) {
  const version = normalizeUpdateVersion(updateInfo?.latestVersion);
  const assetName = normalizeUpdateAssetName(updateInfo?.platformAssetName);
  const root = getUpdateDownloadRoot(app);
  const directoryPath = path.join(root, version);
  const filePath = path.join(directoryPath, assetName);
  if (!isPathInside(root, filePath)) {
    throw new Error('Update download path is not allowed.');
  }

  return {
    assetName,
    directoryPath,
    filePath,
    temporaryFilePath: `${filePath}.download`,
    version,
  };
}

export function removeEmptyParentDirectories(root, startDirectoryPath) {
  let currentPath = startDirectoryPath;
  while (isPathInside(root, currentPath) && currentPath !== root) {
    if (!fs.existsSync(currentPath)) {
      currentPath = path.dirname(currentPath);
      continue;
    }
    const entries = fs.readdirSync(currentPath);
    if (entries.length > 0) return;
    fs.rmdirSync(currentPath);
    currentPath = path.dirname(currentPath);
  }
}

export function cleanupOldUpdateDownloads(app, keepVersion) {
  const normalizedKeepVersion = normalizeUpdateVersion(keepVersion);
  const root = getUpdateDownloadRoot(app);
  if (!fs.existsSync(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === normalizedKeepVersion) {
        continue;
      }
      fs.rmSync(entryPath, { force: true, recursive: true });
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.download')) {
      fs.rmSync(entryPath, { force: true });
    }
  }
}
