import { getElectronBridge } from '@/lib/electron/bridge';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { mapMarkdownOutsideProtectedSegments } from '@/lib/notes/markdown/markdownProtectedBlocks';
import { findExportMarkdownAssetSourceTokens } from './noteExportMarkdownAssetTokens';

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};
const MAX_EXPORT_IMAGE_BYTES = 50 * 1024 * 1024;

function getImageMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function isExportableImagePath(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(IMAGE_MIME_BY_EXTENSION, path.split('.').pop()?.toLowerCase() ?? '');
}

function isExportableImageSize(size: number | null | undefined): boolean {
  return typeof size !== 'number' || size <= MAX_EXPORT_IMAGE_BYTES;
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
  fallbackSrc = src,
): Promise<string> {
  if (!src.startsWith('img:') || !notesPath) {
    return fallbackSrc;
  }

  const bridge = getElectronBridge();
  if (!bridge) {
    return fallbackSrc;
  }

  const assetPath = src.slice(4);
  try {
    const absolutePath = await resolveExistingVaultAssetPath(notesPath, assetPath, notePath);
    if (!absolutePath) {
      return fallbackSrc;
    }

    if (!isExportableImagePath(absolutePath)) {
      return fallbackSrc;
    }

    const fileInfo = await bridge.fs.stat(absolutePath).catch(() => null);
    if (!isExportableImageSize(fileInfo?.size ?? null)) {
      return fallbackSrc;
    }

    const bytes = await bridge.fs.readBinaryFile(absolutePath);
    if (!isExportableImageSize(bytes.byteLength)) {
      return fallbackSrc;
    }

    return `data:${getImageMimeType(absolutePath)};base64,${bytesToBase64(bytes)}`;
  } catch {
    return fallbackSrc;
  }
}

export async function resolveExportMarkdownAssetSources(
  markdown: string,
  notesPath: string,
  notePath: string,
): Promise<string> {
  const segments: string[] = [];
  const protectedMarkdown = mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    const marker = `\0vlaina-export-segment-${segments.length}\0`;
    segments.push(segment);
    return marker;
  }, { protectHtmlBlocks: false });

  const resolvedSegments = await Promise.all(
    segments.map((segment) => resolveExportMarkdownAssetSegment(segment, notesPath, notePath))
  );

  return resolvedSegments.reduce(
    (output, segment, index) => output.replace(`\0vlaina-export-segment-${index}\0`, segment),
    protectedMarkdown,
  );
}

async function resolveExportMarkdownAssetSegment(
  markdown: string,
  notesPath: string,
  notePath: string,
): Promise<string> {
  const tokens = findExportMarkdownAssetSourceTokens(markdown);
  if (tokens.length === 0) {
    return markdown;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.start < cursor) {
      continue;
    }
    parts.push(markdown.slice(cursor, token.start));
    parts.push(await resolveAssetUrl(token.lookupSrc ?? token.src, notesPath, notePath, token.src));
    cursor = token.end;
  }
  parts.push(markdown.slice(cursor));
  return parts.join('');
}
