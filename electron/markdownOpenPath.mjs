import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const maxOpenMarkdownFilePathChars = 8192;

const unsafeOpenMarkdownFilePathPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const markdownFileExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd']);

export function isSafeOpenMarkdownPathString(filePath) {
  return (
    typeof filePath === 'string' &&
    filePath.length > 0 &&
    filePath.length <= maxOpenMarkdownFilePathChars &&
    !unsafeOpenMarkdownFilePathPattern.test(filePath) &&
    filePath.trim().length > 0
  );
}

export function isSupportedMarkdownPath(filePath, pathImpl = path) {
  if (!isSafeOpenMarkdownPathString(filePath)) {
    return false;
  }

  return markdownFileExtensions.has(pathImpl.extname(filePath).toLowerCase());
}

export function normalizeMarkdownOpenPath(value, {
  fsImpl = fs,
  pathImpl = path,
} = {}) {
  if (!isSafeOpenMarkdownPathString(value)) {
    return null;
  }

  const rawPath = value.trim();
  let filePath = rawPath;
  if (rawPath.startsWith('file://')) {
    try {
      filePath = fileURLToPath(rawPath);
    } catch {
      return null;
    }
  }

  if (!isSafeOpenMarkdownPathString(filePath)) {
    return null;
  }

  if (!isSupportedMarkdownPath(filePath, pathImpl)) {
    return null;
  }

  const absolutePath = pathImpl.resolve(filePath);
  if (!isSafeOpenMarkdownPathString(absolutePath)) {
    return null;
  }

  try {
    if (!fsImpl.statSync(absolutePath).isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return absolutePath;
}

export function findMarkdownGitRoot(filePath, {
  fsImpl = fs,
  pathImpl = path,
} = {}) {
  let directoryPath = pathImpl.dirname(filePath);

  while (true) {
    try {
      fsImpl.statSync(pathImpl.join(directoryPath, '.git'));
      return directoryPath;
    } catch {
      const parentPath = pathImpl.dirname(directoryPath);
      if (parentPath === directoryPath) {
        return null;
      }
      directoryPath = parentPath;
    }
  }
}
