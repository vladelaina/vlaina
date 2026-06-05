import electron from 'electron';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { app } = electron;

const authorizedFsRootPaths = new Set();
const authorizedFsFilePaths = new Set();
const authorizedFsWatchRootPaths = new Set();
const MAX_AUTHORIZED_FS_PATHS_JSON_BYTES = 512 * 1024;
export const MAX_AUTHORIZED_FS_PATH_ENTRIES = 2048;
export const MAX_AUTHORIZED_FS_PATH_CHARS = 8192;
const MAX_AUTHORIZED_FS_PATH_KEYS = (MAX_AUTHORIZED_FS_PATH_ENTRIES * 2) + 8;
let authorizedFsPathsLoaded = false;
let authorizedFsPathsLoadPromise = null;
let authorizedFsPathsSavePromise = Promise.resolve();

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`A non-empty ${label} is required.`);
  }

  if (value.length > MAX_AUTHORIZED_FS_PATH_CHARS) {
    throw new Error(`The ${label} is too long for desktop access.`);
  }

  if (!value.trim()) {
    throw new Error(`A non-empty ${label} is required.`);
  }

  return value;
}

function requireFilePath(value) {
  return requireNonEmptyString(value, 'file path');
}

export function normalizeFsPathForAccess(filePath) {
  return path.resolve(requireFilePath(filePath));
}

export function normalizeFsPathKey(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isSameOrChildPath(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isMissingFsPathError(error) {
  return Boolean(error && typeof error === 'object' && (error.code === 'ENOENT' || error.code === 'ENOTDIR'));
}

async function resolveRealFsAccessPath(resolvedPath) {
  const unresolvedParts = [];
  let cursor = resolvedPath;

  for (;;) {
    try {
      const realBasePath = await realpath(cursor);
      return unresolvedParts.length > 0
        ? path.resolve(realBasePath, ...unresolvedParts.reverse())
        : realBasePath;
    } catch (error) {
      if (!isMissingFsPathError(error)) {
        throw error;
      }

      const parentPath = path.dirname(cursor);
      if (parentPath === cursor) {
        return resolvedPath;
      }

      unresolvedParts.push(path.basename(cursor));
      cursor = parentPath;
    }
  }
}

function addAuthorizedFsPathKey(kind, pathKey) {
  if (typeof pathKey !== 'string' || !pathKey.trim() || pathKey.length > MAX_AUTHORIZED_FS_PATH_CHARS) {
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
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
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
  return path.join(app.getPath('userData'), '.vlaina', 'store', 'authorized-fs-paths.json');
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
      entry.trim() &&
      entry.length <= MAX_AUTHORIZED_FS_PATH_CHARS
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

export function isProtectedAppDataPath(candidatePath, userDataPath = app.getPath('userData')) {
  const candidateKey = normalizeFsPathKey(candidatePath);
  const protectedRoots = [path.join(userDataPath, '.vlaina', 'secrets')]
    .map((protectedPath) => normalizeFsPathKey(protectedPath));
  const protectedFiles = [
    path.join(userDataPath, '.vlaina', 'store', 'account-secrets.json'),
    path.join(userDataPath, '.vlaina', 'store', 'account-meta.json'),
    path.join(userDataPath, '.vlaina', 'store', 'authorized-fs-paths.json'),
  ].map((protectedPath) => normalizeFsPathKey(protectedPath));

  return (
    protectedRoots.some((protectedRoot) => isSameOrChildPath(protectedRoot, candidateKey)) ||
    protectedFiles.includes(candidateKey)
  );
}

async function isProtectedFsAccessPath(candidatePath) {
  if (isProtectedAppDataPath(candidatePath)) {
    return true;
  }

  const realUserDataPath = await resolveRealFsAccessPath(normalizeFsPathForAccess(app.getPath('userData'))).catch(() => null);
  return realUserDataPath ? isProtectedAppDataPath(candidatePath, realUserDataPath) : false;
}

async function readAuthorizedFsPaths() {
  try {
    const storePath = getAuthorizedFsPathsPath();
    const fileInfo = await stat(storePath);
    if (!fileInfo.isFile() || fileInfo.size > MAX_AUTHORIZED_FS_PATHS_JSON_BYTES) {
      return { roots: [], files: [], watchRoots: [] };
    }
    const payload = JSON.parse(await readFile(storePath, 'utf8'));
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

async function writeAuthorizedFsPaths() {
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
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(
      storePath,
      JSON.stringify({
        roots,
        files,
        watchRoots,
      }, null, 2),
      'utf8',
    );
  });

  return authorizedFsPathsSavePromise;
}

async function ensureAuthorizedFsPathsLoaded() {
  if (authorizedFsPathsLoaded) {
    return;
  }

  if (!authorizedFsPathsLoadPromise) {
    authorizedFsPathsLoadPromise = (async () => {
      await addAuthorizedFsPathWithRealKey(app.getPath('userData'), 'root');

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

export async function assertAuthorizedFsPath(filePath) {
  const resolvedPath = normalizeFsPathForAccess(filePath);
  await ensureAuthorizedFsPathsLoaded();
  if (await isProtectedFsAccessPath(resolvedPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const realAccessPath = await resolveRealFsAccessPath(resolvedPath);
  if (await isProtectedFsAccessPath(realAccessPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const pathKey = normalizeFsPathKey(realAccessPath);
  if (!isAuthorizedFsPathKey(pathKey)) {
    throw new Error(`File path is not authorized for desktop access: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function assertAuthorizedFsWatchPath(filePath) {
  const resolvedPath = normalizeFsPathForAccess(filePath);
  await ensureAuthorizedFsPathsLoaded();
  if (await isProtectedFsAccessPath(resolvedPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const realAccessPath = await resolveRealFsAccessPath(resolvedPath);
  if (await isProtectedFsAccessPath(realAccessPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const pathKey = normalizeFsPathKey(realAccessPath);
  if (!isAuthorizedFsWatchPathKey(pathKey)) {
    throw new Error(`File path is not authorized for desktop watch access: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function authorizeFsPath(filePath, kind) {
  const resolvedPath = normalizeFsPathForAccess(filePath);
  await ensureAuthorizedFsPathsLoaded();
  if (await isProtectedFsAccessPath(resolvedPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const realAccessPath = await resolveRealFsAccessPath(resolvedPath);
  if (await isProtectedFsAccessPath(realAccessPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }
  const pathKey = normalizeFsPathKey(resolvedPath);
  const realPathKey = normalizeFsPathKey(realAccessPath);

  addAuthorizedFsPathKey(kind, pathKey);
  addAuthorizedFsPathKey(kind, realPathKey);

  await writeAuthorizedFsPaths();
  return resolvedPath;
}

export function canRenameAuthorizedRoot(sourcePath, targetPath) {
  const sourceKey = normalizeFsPathKey(sourcePath);
  if (!authorizedFsRootPaths.has(sourceKey)) {
    return false;
  }

  return normalizeFsPathKey(path.dirname(sourcePath)) === normalizeFsPathKey(path.dirname(targetPath));
}

export async function assertAuthorizedFsRenameTarget(sourcePath, targetPath) {
  const resolvedSourcePath = normalizeFsPathForAccess(sourcePath);
  const resolvedTargetPath = normalizeFsPathForAccess(targetPath);
  if (canRenameAuthorizedRoot(resolvedSourcePath, resolvedTargetPath)) {
    if (await isProtectedFsAccessPath(resolvedTargetPath)) {
      throw new Error(`File path is reserved for internal desktop storage: ${resolvedTargetPath}`);
    }

    const realTargetPath = await resolveRealFsAccessPath(resolvedTargetPath);
    if (await isProtectedFsAccessPath(realTargetPath)) {
      throw new Error(`File path is reserved for internal desktop storage: ${resolvedTargetPath}`);
    }
    return resolvedTargetPath;
  }

  return assertAuthorizedFsPath(resolvedTargetPath);
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
