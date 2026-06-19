import electron from 'electron';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { app } = electron;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.dirname(__dirname);

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

function getDevelopmentUserDataOverridePath() {
  if (app.isPackaged) {
    return null;
  }

  const overridePath = process.env.VLAINA_USER_DATA_DIR?.trim();
  return overridePath ? path.resolve(overridePath) : null;
}

function getDevelopmentRepoUserDataRootPath(candidatePath) {
  if (app.isPackaged) {
    return null;
  }

  const resolvedCandidatePath = normalizeFsPathForAccess(candidatePath);
  const tempRootPath = path.join(repoRoot, 'temp');
  const relativePath = path.relative(tempRootPath, resolvedCandidatePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  const [firstSegment] = relativePath.split(path.sep);
  if (!/^electron-user-data-\d+$/.test(firstSegment ?? '')) {
    return null;
  }

  return path.join(tempRootPath, firstSegment);
}

function getUserDataAccessRootPaths() {
  const paths = [];

  try {
    paths.push(normalizeFsPathForAccess(app.getPath('userData')));
  } catch {}

  const overridePath = getDevelopmentUserDataOverridePath();
  if (overridePath) {
    paths.push(overridePath);
  }

  const seen = new Set();
  const uniquePaths = [];
  for (const entry of paths) {
    const key = normalizeFsPathKey(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniquePaths.push(entry);
  }

  return uniquePaths;
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

export function isProtectedAppDataPath(candidatePath, userDataPath = app.getPath('userData')) {
  const candidateKey = normalizeFsPathKey(candidatePath);
  const protectedRoots = [path.join(userDataPath, '.vlaina', 'app', 'secrets')]
    .map((protectedPath) => normalizeFsPathKey(protectedPath));
  const protectedFiles = [
    path.join(userDataPath, '.vlaina', 'app', 'account', 'profile.json'),
    path.join(userDataPath, '.vlaina', 'app', 'permissions', 'filesystem.json'),
  ].map((protectedPath) => normalizeFsPathKey(protectedPath));

  return (
    protectedRoots.some((protectedRoot) => isSameOrChildPath(protectedRoot, candidateKey)) ||
    protectedFiles.includes(candidateKey)
  );
}

async function isProtectedFsAccessPath(candidatePath) {
  const userDataPaths = getUserDataAccessRootPaths();
  const developmentRepoUserDataRootPath = getDevelopmentRepoUserDataRootPath(candidatePath);
  if (developmentRepoUserDataRootPath) {
    userDataPaths.push(developmentRepoUserDataRootPath);
  }

  for (const userDataPath of userDataPaths) {
    if (isProtectedAppDataPath(candidatePath, userDataPath)) {
      return true;
    }

    const realUserDataPath = await resolveRealFsAccessPath(userDataPath).catch(() => null);
    if (realUserDataPath && isProtectedAppDataPath(candidatePath, realUserDataPath)) {
      return true;
    }
  }

  return false;
}

async function isUserDataFsAccessPath(resolvedPath, realAccessPath) {
  const resolvedPathKey = normalizeFsPathKey(resolvedPath);
  const realAccessPathKey = normalizeFsPathKey(realAccessPath);
  const paths = getUserDataAccessRootPaths();
  const developmentRepoUserDataRootPath = getDevelopmentRepoUserDataRootPath(resolvedPath);
  if (developmentRepoUserDataRootPath) {
    paths.push(developmentRepoUserDataRootPath);
  }

  const seen = new Set();
  for (const userDataPath of paths) {
    const userDataPathKey = normalizeFsPathKey(userDataPath);
    if (seen.has(userDataPathKey)) {
      continue;
    }
    seen.add(userDataPathKey);

    const realUserDataPath = await resolveRealFsAccessPath(userDataPath).catch(() => null);
    const realUserDataPathKey = realUserDataPath ? normalizeFsPathKey(realUserDataPath) : userDataPathKey;

    if (
      isSameOrChildPath(userDataPathKey, resolvedPathKey) &&
      isSameOrChildPath(realUserDataPathKey, realAccessPathKey)
    ) {
      return true;
    }
  }

  return false;
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

async function resolveSafeFsAccessPath(filePath) {
  const resolvedPath = normalizeFsPathForAccess(filePath);
  await ensureAuthorizedFsPathsLoaded();
  if (await isProtectedFsAccessPath(resolvedPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const realAccessPath = await resolveRealFsAccessPath(resolvedPath);
  if (await isProtectedFsAccessPath(realAccessPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  return { resolvedPath, realAccessPath };
}

export async function assertSafeFsAccessPath(filePath) {
  return (await resolveSafeFsAccessPath(filePath)).resolvedPath;
}

export async function assertAuthorizedFsPath(filePath) {
  const { resolvedPath, realAccessPath } = await resolveSafeFsAccessPath(filePath);
  if (await isUserDataFsAccessPath(resolvedPath, realAccessPath)) {
    return resolvedPath;
  }

  const pathKey = normalizeFsPathKey(realAccessPath);
  if (!isAuthorizedFsPathKey(pathKey)) {
    throw new Error(`File path is not authorized for desktop access: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function assertAuthorizedFsWatchPath(filePath) {
  const { resolvedPath, realAccessPath } = await resolveSafeFsAccessPath(filePath);
  if (await isUserDataFsAccessPath(resolvedPath, realAccessPath)) {
    return resolvedPath;
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
