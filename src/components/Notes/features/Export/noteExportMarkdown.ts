import { getElectronBridge } from '@/lib/electron/bridge';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function getImageMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function resolveAssetUrl(
  src: string,
  notesPath: string,
  notePath: string,
): Promise<string> {
  if (!src.startsWith('img:') || !notesPath) {
    return src;
  }

  const bridge = getElectronBridge();
  if (!bridge) {
    return src;
  }

  const assetPath = src.slice(4);
  const absolutePath = await resolveExistingVaultAssetPath(notesPath, assetPath, notePath);
  const bytes = await bridge.fs.readBinaryFile(absolutePath);
  return `data:${getImageMimeType(absolutePath)};base64,${bytesToBase64(bytes)}`;
}

async function replaceAsync(
  value: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>,
): Promise<string> {
  const matches = Array.from(value.matchAll(pattern));
  if (matches.length === 0) {
    return value;
  }

  let cursor = 0;
  const parts: string[] = [];

  for (const match of matches) {
    const index = match.index ?? 0;
    parts.push(value.slice(cursor, index));
    parts.push(await replacer(...(match as unknown as string[])));
    cursor = index + match[0].length;
  }

  parts.push(value.slice(cursor));
  return parts.join('');
}

export async function resolveExportMarkdownAssetSources(
  markdown: string,
  notesPath: string,
  notePath: string,
): Promise<string> {
  const withMarkdownImages = await replaceAsync(
    markdown,
    /(!\[[^\]]*]\()([^)\s]+)(\))/g,
    async (_full, prefix, src, suffix) => {
      const resolvedSrc = await resolveAssetUrl(src, notesPath, notePath);
      return `${prefix}${resolvedSrc}${suffix}`;
    },
  );

  return replaceAsync(
    withMarkdownImages,
    /(<img\b[^>]*\bsrc=["'])(img:[^"']+)(["'][^>]*>)/gi,
    async (_full, prefix, src, suffix) => {
      const resolvedSrc = await resolveAssetUrl(src, notesPath, notePath);
      return `${prefix}${resolvedSrc}${suffix}`;
    },
  );
}
