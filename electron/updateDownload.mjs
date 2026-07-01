import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { normalizeHttpUrl } from './externalUrlPolicy.mjs';

const maxUpdateDownloadBytes = 1024 * 1024 * 1024;
const allowedUpdateAssetPattern = /^vlaina-[0-9A-Za-z._+-]+\.(?:exe|dmg|zip|AppImage|deb|tar\.gz)$/;
const allowedUpdateVersionPattern = /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/;

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function isPathInside(parentPath, childPath) {
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

function normalizeUpdateVersion(rawVersion) {
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

function requireUpdateAssetSha256(rawSha256) {
  const sha256 = normalizeUpdateAssetSha256(rawSha256);
  if (!sha256) {
    throw new Error('Update asset SHA-256 is required.');
  }
  return sha256;
}

function getUpdateDownloadTarget(app, updateInfo) {
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

function removeEmptyParentDirectories(root, startDirectoryPath) {
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

function getExistingTemporaryDownloadSize(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0 ? stat.size : 0;
  } catch {
    return 0;
  }
}

async function writeResponseBodyToFile(response, filePath, {
  append = false,
  existingBytes = 0,
} = {}) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('Update download response body is unavailable.');
  }

  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(contentLength) && existingBytes + contentLength > maxUpdateDownloadBytes) {
    throw new Error('Update download is too large.');
  }

  const reader = response.body.getReader();
  const stream = fs.createWriteStream(filePath, { flags: append ? 'a' : 'w' });
  let downloadedBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      downloadedBytes += chunk.byteLength;
      if (existingBytes + downloadedBytes > maxUpdateDownloadBytes) {
        throw new Error('Update download is too large.');
      }
      if (!stream.write(chunk)) {
        await new Promise((resolve, reject) => {
          stream.once('drain', resolve);
          stream.once('error', reject);
        });
      }
    }
  } catch (error) {
    stream.destroy();
    throw error;
  } finally {
    reader.releaseLock();
  }

  await new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  if (existingBytes + downloadedBytes <= 0) {
    throw new Error('Update download is empty.');
  }

  return existingBytes + downloadedBytes;
}

function createUpdateDownloadRequestOptions(app, resumeFromBytes = 0, signal) {
  const headers = {
    accept: 'application/octet-stream',
    'user-agent': `vlaina/${app.getVersion()} desktop-update-downloader`,
  };

  if (resumeFromBytes > 0) {
    headers.range = `bytes=${resumeFromBytes}-`;
  }

  return {
    cache: 'no-store',
    headers,
    signal,
  };
}

async function fetchUpdateDownloadResponse({
  app,
  downloadUrl,
  fetchImpl,
  resumeFromBytes = 0,
  signal,
}) {
  return await fetchImpl(downloadUrl, createUpdateDownloadRequestOptions(app, resumeFromBytes, signal));
}

function getContentRangeStart(response) {
  const contentRange = response.headers.get('content-range') ?? '';
  const match = contentRange.match(/^bytes\s+(\d+)-/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function calculateFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function verifyDownloadedUpdateSha256(filePath, expectedSha256) {
  if (!expectedSha256) return;
  const actualSha256 = await calculateFileSha256(filePath);
  if (actualSha256 !== expectedSha256) {
    throw new Error('Downloaded update SHA-256 does not match.');
  }
}

export async function downloadUpdateAsset({
  app,
  updateInfo,
  fetchImpl,
  signal,
}) {
  if (!updateInfo?.hasPlatformAsset) {
    throw new Error('No platform update asset is available.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Update download fetch implementation is required.');
  }

  const downloadUrl = normalizeHttpUrl(updateInfo.downloadUrl, 'Update download URL');
  const expectedSha256 = requireUpdateAssetSha256(updateInfo.platformAssetSha256);
  const target = getUpdateDownloadTarget(app, updateInfo);

  cleanupOldUpdateDownloads(app, target.version);
  fs.mkdirSync(target.directoryPath, { recursive: true });
  if (fs.existsSync(target.filePath)) {
    const stat = fs.statSync(target.filePath);
    if (stat.isFile() && stat.size > 0) {
      try {
        await verifyDownloadedUpdateSha256(target.filePath, expectedSha256);
      } catch (error) {
        fs.rmSync(target.filePath, { force: true });
        throw error;
      }
      return {
        filePath: target.filePath,
        fileName: target.assetName,
        downloadedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    }
  }

  let resumeFromBytes = getExistingTemporaryDownloadSize(target.temporaryFilePath);
  let response = await fetchUpdateDownloadResponse({
    app,
    downloadUrl,
    fetchImpl,
    resumeFromBytes,
    signal,
  });

  if (resumeFromBytes > 0 && response.status === 416) {
    fs.rmSync(target.temporaryFilePath, { force: true });
    resumeFromBytes = 0;
    response = await fetchUpdateDownloadResponse({
      app,
      downloadUrl,
      fetchImpl,
      resumeFromBytes,
      signal,
    });
  } else if (resumeFromBytes > 0 && response.status === 206 && getContentRangeStart(response) !== resumeFromBytes) {
    fs.rmSync(target.temporaryFilePath, { force: true });
    resumeFromBytes = 0;
    response = await fetchUpdateDownloadResponse({
      app,
      downloadUrl,
      fetchImpl,
      resumeFromBytes,
      signal,
    });
  } else if (resumeFromBytes > 0 && response.status !== 206) {
    fs.rmSync(target.temporaryFilePath, { force: true });
    resumeFromBytes = 0;
  }

  if (!response.ok) {
    throw new Error(`Update download failed: HTTP ${response.status}`);
  }

  try {
    const sizeBytes = await writeResponseBodyToFile(response, target.temporaryFilePath, {
      append: resumeFromBytes > 0 && response.status === 206,
      existingBytes: resumeFromBytes,
    });
    fs.renameSync(target.temporaryFilePath, target.filePath);
    if (process.platform === 'linux') {
      fs.chmodSync(target.filePath, 0o755);
    }
    try {
      await verifyDownloadedUpdateSha256(target.filePath, expectedSha256);
    } catch (error) {
      fs.rmSync(target.filePath, { force: true });
      throw error;
    }
    const stat = fs.statSync(target.filePath);
    return {
      filePath: target.filePath,
      fileName: target.assetName,
      downloadedAt: stat.mtime.toISOString(),
      sizeBytes,
    };
  } catch (error) {
    throw error;
  }
}

export function normalizeDownloadedUpdatePath(app, filePath) {
  const root = getUpdateDownloadRoot(app);
  const resolvedPath = path.resolve(requireString(filePath, 'Downloaded update path'));
  if (!isPathInside(root, resolvedPath)) {
    throw new Error('Downloaded update path is not allowed.');
  }
  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new Error('Downloaded update path is not a file.');
  }
  normalizeUpdateAssetName(path.basename(resolvedPath));
  return resolvedPath;
}

export async function normalizeDownloadedUpdateForOpen(app, updateInfo) {
  if (!updateInfo?.hasPlatformAsset) {
    throw new Error('No platform update asset is available.');
  }

  const expectedSha256 = requireUpdateAssetSha256(updateInfo.platformAssetSha256);
  const target = getUpdateDownloadTarget(app, updateInfo);
  const resolvedDownloadedPath = typeof updateInfo.downloadedFilePath === 'string' && updateInfo.downloadedFilePath.trim()
    ? path.resolve(updateInfo.downloadedFilePath)
    : '';
  if (resolvedDownloadedPath && resolvedDownloadedPath !== target.filePath) {
    throw new Error('Downloaded update path does not match the requested update.');
  }

  const stat = fs.statSync(target.filePath);
  if (!stat.isFile() || stat.size <= 0) {
    throw new Error('Downloaded update path is not a file.');
  }
  await verifyDownloadedUpdateSha256(target.filePath, expectedSha256);
  return target.filePath;
}

export function deleteDownloadedUpdate(app, updateInfoOrFilePath) {
  const root = getUpdateDownloadRoot(app);

  if (typeof updateInfoOrFilePath === 'string') {
    const resolvedPath = path.resolve(requireString(updateInfoOrFilePath, 'Downloaded update path'));
    if (!isPathInside(root, resolvedPath)) {
      throw new Error('Downloaded update path is not allowed.');
    }
    normalizeUpdateAssetName(path.basename(resolvedPath));
    fs.rmSync(resolvedPath, { force: true });
    fs.rmSync(`${resolvedPath}.download`, { force: true });
    removeEmptyParentDirectories(root, path.dirname(resolvedPath));
    return;
  }

  const version = normalizeUpdateVersion(updateInfoOrFilePath?.latestVersion);
  const directoryPath = path.join(root, version);
  if (!isPathInside(root, directoryPath)) {
    throw new Error('Downloaded update path is not allowed.');
  }
  fs.rmSync(directoryPath, { force: true, recursive: true });
}
