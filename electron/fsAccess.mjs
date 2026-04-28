import electron from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { app } = electron;

const authorizedFsRootPaths = new Set();
const authorizedFsFilePaths = new Set();
const authorizedFsWatchRootPaths = new Set();
let authorizedFsPathsLoaded = false;
let authorizedFsPathsLoadPromise = null;
let authorizedFsPathsSavePromise = Promise.resolve();

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
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

function getAuthorizedFsPathsPath() {
  return path.join(app.getPath('userData'), '.vlaina', 'store', 'authorized-fs-paths.json');
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

async function readAuthorizedFsPaths() {
  try {
    const payload = JSON.parse(await readFile(getAuthorizedFsPathsPath(), 'utf8'));
    return {
      roots: Array.isArray(payload?.roots) ? payload.roots : [],
      files: Array.isArray(payload?.files) ? payload.files : [],
      watchRoots: Array.isArray(payload?.watchRoots) ? payload.watchRoots : [],
    };
  } catch {
    return { roots: [], files: [], watchRoots: [] };
  }
}

async function writeAuthorizedFsPaths() {
  authorizedFsPathsSavePromise = authorizedFsPathsSavePromise.then(async () => {
    const storePath = getAuthorizedFsPathsPath();
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(
      storePath,
      JSON.stringify({
        roots: Array.from(authorizedFsRootPaths).sort(),
        files: Array.from(authorizedFsFilePaths).sort(),
        watchRoots: Array.from(authorizedFsWatchRootPaths).sort(),
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
      const appDataPath = normalizeFsPathKey(app.getPath('userData'));
      authorizedFsRootPaths.add(appDataPath);

      const saved = await readAuthorizedFsPaths();
      for (const rootPath of saved.roots) {
        if (typeof rootPath === 'string' && rootPath.trim()) {
          authorizedFsRootPaths.add(normalizeFsPathKey(rootPath));
        }
      }
      for (const filePath of saved.files) {
        if (typeof filePath === 'string' && filePath.trim()) {
          authorizedFsFilePaths.add(normalizeFsPathKey(filePath));
        }
      }
      for (const watchRootPath of saved.watchRoots) {
        if (typeof watchRootPath === 'string' && watchRootPath.trim()) {
          authorizedFsWatchRootPaths.add(normalizeFsPathKey(watchRootPath));
        }
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
  await ensureAuthorizedFsPathsLoaded();
  const resolvedPath = normalizeFsPathForAccess(filePath);
  if (isProtectedAppDataPath(resolvedPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const pathKey = normalizeFsPathKey(resolvedPath);
  if (!isAuthorizedFsPathKey(pathKey)) {
    throw new Error(`File path is not authorized for desktop access: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function assertAuthorizedFsWatchPath(filePath) {
  await ensureAuthorizedFsPathsLoaded();
  const resolvedPath = normalizeFsPathForAccess(filePath);
  if (isProtectedAppDataPath(resolvedPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const pathKey = normalizeFsPathKey(resolvedPath);
  if (!isAuthorizedFsWatchPathKey(pathKey)) {
    throw new Error(`File path is not authorized for desktop watch access: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function authorizeFsPath(filePath, kind) {
  await ensureAuthorizedFsPathsLoaded();
  const resolvedPath = normalizeFsPathForAccess(filePath);
  if (isProtectedAppDataPath(resolvedPath)) {
    throw new Error(`File path is reserved for internal desktop storage: ${resolvedPath}`);
  }

  const pathKey = normalizeFsPathKey(resolvedPath);

  if (kind === 'file') {
    authorizedFsFilePaths.add(pathKey);
  } else if (kind === 'watch-root') {
    authorizedFsWatchRootPaths.add(pathKey);
  } else {
    authorizedFsRootPaths.add(pathKey);
  }

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

export async function updateAuthorizedRootRename(sourcePath, targetPath) {
  const sourceKey = normalizeFsPathKey(sourcePath);
  if (!authorizedFsRootPaths.has(sourceKey)) {
    return;
  }

  authorizedFsRootPaths.delete(sourceKey);
  authorizedFsRootPaths.add(normalizeFsPathKey(targetPath));
  await writeAuthorizedFsPaths();
}
