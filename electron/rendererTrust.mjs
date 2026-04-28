import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizeRendererFilePath(filePath) {
  const normalizedPath = path.normalize(path.resolve(filePath));
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;
}

export function isTrustedRendererUrl(rawUrl, { rendererDevUrl, rendererFile }) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'file:') {
      return normalizeRendererFilePath(fileURLToPath(url)) === normalizeRendererFilePath(rendererFile);
    }

    const rendererOrigin = new URL(rendererDevUrl).origin;
    return url.origin === rendererOrigin;
  } catch {
    return false;
  }
}
