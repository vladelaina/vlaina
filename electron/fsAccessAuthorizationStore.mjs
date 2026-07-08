import electron from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ensurePrivateDirectory, writePrivateFile } from './privateFilePermissions.mjs';
import {
  getDevelopmentUserDataOverridePath,
  isProtectedFsAccessPath,
  isSameOrChildPath,
  MAX_AUTHORIZED_FS_PATH_CHARS,
  normalizeFsPathForAccess,
  normalizeFsPathKey,
  resolveRealFsAccessPath,
} from './fsAccessPathPolicy.mjs';

const { app } = electron;

const authorizedFsRootPaths = new Set();
const authorizedFsFilePaths = new Set();
const authorizedFsWatchRootPaths = new Set();
const MAX_AUTHORIZED_FS_PATHS_JSON_BYTES = 512 * 1024;
export const MAX_AUTHORIZED_FS_PATH_ENTRIES = 2048;
const MAX_AUTHORIZED_FS_PATH_KEYS = (MAX_AUTHORIZED_FS_PATH_ENTRIES * 2) + 8;
let authorizedFsPathsLoaded = false;
let authorizedFsPathsLoadPromise = null;
let authorizedFsPathsSavePromise = Promise.resolve();

export function addAuthorizedFsPathKey(kind, pathKey) {
  if (typeof pathKey !== 'string' || pathKey.length > MAX_AUTHORIZED_FS_PATH_CHARS || !pathKey.trim()) {
    return;
  }

  const targetSet = kind === 'file'
    ? authorizedFsFilePaths
    : kind === 'watch-root'
      ? authorizedFsWatchRootPaths
      : authorizedFsRootPaths;
  if (targetSet.size >= MAX_AUTHORIZED_FS_PATH_KEYS && !targetSet.has(pathKey)) {
    return;
  }

  targetSet.add(pathKey);
}

async function addAuthorizedFsPathWithRealKey(rawPath, kind) {
  if (typeof rawPath !== 'string' || rawPath.length > MAX_AUTHORIZED_FS_PATH_CHARS || !rawPath.trim()) {
    return;
  }

  const resolvedPath = normalizeFsPathForAccess(rawPath);
  if (await isProtectedFsAccessPath(resolvedPath)) {
    return;
  }

  addAuthorizedFsPathKey(kind, normalizeFsPathKey(resolvedPath));

  const realAccessPath = await resolveRealFsAccessPath(resolvedPath);
  if (!(await isProtectedFsAccessPath(realAccessPath))) {
    addAuthorizedFsPathKey(kind, normalizeFsPathKey(realAccessPath));
  }
}

function getAuthorizedFsPathsPath() {
  return path.join(app.getPath('userData'), '.vlaina', 'app', 'permissions', 'filesystem.json');
}

function normalizeAuthorizedFsPathEntries(value, maxEntries) {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = [];
  for (const entry of value) {
    if (entries.length >= maxEntries) {
      break;
    }
    if (
      typeof entry === 'string' &&
      entry.length <= MAX_AUTHORIZED_FS_PATH_CHARS &&
      entry.trim()
    ) {
      entries.push(entry);
    }
  }
  return entries;
}

function getPersistedAuthorizedFsPathEntries(pathSet, maxEntries) {
  if (maxEntries <= 0) {
    return [];
  }

  return Array.from(pathSet)
    .filter((entry) => entry.length <= MAX_AUTHORIZED_FS_PATH_CHARS)
    .sort()
    .slice(0, maxEntries);
}

async function readAuthorizedFsPaths() {
  try {
    const storePath = getAuthorizedFsPathsPath();
    const fileInfo = await stat(storePath);
    if (!fileInfo.isFile() || fileInfo.size > MAX_AUTHORIZED_FS_PATHS_JSON_BYTES) {
      return { roots: [], files: [], watchRoots: [] };
    }
    const content = await readFile(storePath, 'utf8');
    if (Buffer.byteLength(content, 'utf8') > MAX_AUTHORIZED_FS_PATHS_JSON_BYTES) {
      return { roots: [], files: [], watchRoots: [] };
    }
    const payload = JSON.parse(content);
    const roots = normalizeAuthorizedFsPathEntries(payload?.roots, MAX_AUTHORIZED_FS_PATH_ENTRIES);
    const files = normalizeAuthorizedFsPathEntries(
      payload?.files,
      MAX_AUTHORIZED_FS_PATH_ENTRIES - roots.length
    );
    const watchRoots = normalizeAuthorizedFsPathEntries(
      payload?.watchRoots,
      MAX_AUTHORIZED_FS_PATH_ENTRIES - roots.length - files.length
    );
    return {
      roots,
      files,
      watchRoots,
    };
  } catch {
    return { roots: [], files: [], watchRoots: [] };
  }
}

export async function writeAuthorizedFsPaths() {
  authorizedFsPathsSavePromise = authorizedFsPathsSavePromise.catch(() => undefined).then(async () => {
    const storePath = getAuthorizedFsPathsPath();
    const roots = getPersistedAuthorizedFsPathEntries(
      authorizedFsRootPaths,
      MAX_AUTHORIZED_FS_PATH_ENTRIES
    );
    const files = getPersistedAuthorizedFsPathEntries(
      authorizedFsFilePaths,
      MAX_AUTHORIZED_FS_PATH_ENTRIES - roots.length
    );
    const watchRoots = getPersistedAuthorizedFsPathEntries(
      authorizedFsWatchRootPaths,
      MAX_AUTHORIZED_FS_PATH_ENTRIES - roots.length - files.length
    );
    await ensurePrivateDirectory(path.dirname(storePath));
    await writePrivateFile(
      storePath,
      JSON.stringify({
        roots,
        files,
        watchRoots,
      }, null, 2),
    );
  });

  return authorizedFsPathsSavePromise;
}

export async function ensureAuthorizedFsPathsLoaded() {
  if (authorizedFsPathsLoaded) {
    return;
  }

  if (!authorizedFsPathsLoadPromise) {
    authorizedFsPathsLoadPromise = (async () => {
      await addAuthorizedFsPathWithRealKey(app.getPath('userData'), 'root');
      const developmentUserDataOverridePath = getDevelopmentUserDataOverridePath();
      if (developmentUserDataOverridePath) {
        await addAuthorizedFsPathWithRealKey(developmentUserDataOverridePath, 'root');
      }

      const saved = await readAuthorizedFsPaths();
      for (const rootPath of saved.roots) {
        await addAuthorizedFsPathWithRealKey(rootPath, 'root');
      }
      for (const filePath of saved.files) {
        await addAuthorizedFsPathWithRealKey(filePath, 'file');
      }
      for (const watchRootPath of saved.watchRoots) {
        await addAuthorizedFsPathWithRealKey(watchRootPath, 'watch-root');
      }

      authorizedFsPathsLoaded = true;
    })();
  }

  await authorizedFsPathsLoadPromise;
}

export function isAuthorizedFsPathKey(candidateKey) {
  if (authorizedFsFilePaths.has(candidateKey)) {
    return true;
  }

  for (const rootKey of authorizedFsRootPaths) {
    if (isSameOrChildPath(rootKey, candidateKey)) {
      return true;
    }
  }

  return false;
}

export function isAuthorizedFsWatchPathKey(candidateKey) {
  if (isAuthorizedFsPathKey(candidateKey)) {
    return true;
  }

  for (const rootKey of authorizedFsWatchRootPaths) {
    if (isSameOrChildPath(rootKey, candidateKey)) {
      return true;
    }
  }

  return false;
}

export function canRenameAuthorizedRoot(sourcePath, targetPath) {
  const sourceKey = normalizeFsPathKey(sourcePath);
  if (!authorizedFsRootPaths.has(sourceKey)) {
    return false;
  }

  return normalizeFsPathKey(path.dirname(sourcePath)) === normalizeFsPathKey(path.dirname(targetPath));
}

export async function updateAuthorizedRootRename(sourcePath, targetPath) {
  const sourceKey = normalizeFsPathKey(sourcePath);
  if (!authorizedFsRootPaths.has(sourceKey)) {
    return;
  }

  authorizedFsRootPaths.delete(sourceKey);
  authorizedFsRootPaths.add(normalizeFsPathKey(targetPath));
  await writeAuthorizedFsPaths();
}

export function resetAuthorizedFsPathsForTests() {
  if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
    throw new Error('resetAuthorizedFsPathsForTests is only available in tests.');
  }

  authorizedFsRootPaths.clear();
  authorizedFsFilePaths.clear();
  authorizedFsWatchRootPaths.clear();
  authorizedFsPathsLoaded = false;
  authorizedFsPathsLoadPromise = null;
  authorizedFsPathsSavePromise = Promise.resolve();
}
