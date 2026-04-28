import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const authorizedFsRootPaths = new Set();
const authorizedFsFilePaths = new Set();
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

async function readAuthorizedFsPaths() {
  try {
    const payload = JSON.parse(await readFile(getAuthorizedFsPathsPath(), 'utf8'));
    return {
      roots: Array.isArray(payload?.roots) ? payload.roots : [],
      files: Array.isArray(payload?.files) ? payload.files : [],
    };
  } catch {
    return { roots: [], files: [] };
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

export async function assertAuthorizedFsPath(filePath) {
  await ensureAuthorizedFsPathsLoaded();
  const resolvedPath = normalizeFsPathForAccess(filePath);
  const pathKey = normalizeFsPathKey(resolvedPath);
  if (!isAuthorizedFsPathKey(pathKey)) {
    throw new Error(`File path is not authorized for desktop access: ${resolvedPath}`);
  }

  return resolvedPath;
}

export async function authorizeFsPath(filePath, kind) {
  await ensureAuthorizedFsPathsLoaded();
  const resolvedPath = normalizeFsPathForAccess(filePath);
  const pathKey = normalizeFsPathKey(resolvedPath);

  if (kind === 'file') {
    authorizedFsFilePaths.add(pathKey);
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
