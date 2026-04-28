import { fileURLToPath } from 'node:url';

export function isTrustedRendererUrl(rawUrl, { rendererDevUrl, rendererFile }) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'file:') {
      return fileURLToPath(url) === rendererFile;
    }

    const rendererOrigin = new URL(rendererDevUrl).origin;
    return url.origin === rendererOrigin;
  } catch {
    return false;
  }
}
