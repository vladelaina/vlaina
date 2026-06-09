import { getElectronBridge } from '@/lib/electron/bridge';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { mapMarkdownOutsideProtectedSegments } from '@/lib/notes/markdown/markdownProtectedBlocks';
import { getNoteInternalImageAssetPath } from '@/lib/notes/markdown/urlSecurity';
import {
  MAX_EXPORT_MARKDOWN_ASSET_TOKENS,
  findExportMarkdownAssetSourceTokensWithOptions,
} from './noteExportMarkdownAssetTokens';

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const MAX_EXPORT_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_EXPORT_EMBEDDED_IMAGE_BYTES = 50 * 1024 * 1024;

function getImageMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

function isExportableImagePath(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(IMAGE_MIME_BY_EXTENSION, path.split('.').pop()?.toLowerCase() ?? '');
}

function isExportableImageSize(size: number | null | undefined): boolean {
  return typeof size === 'number' && size <= MAX_EXPORT_IMAGE_BYTES;
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

function createExportSegmentMarkerPrefix(markdown: string): string {
  let salt = 0;
  let prefix = '';
  do {
    prefix = `\0vlaina-export-segment-${salt}-`;
    salt += 1;
  } while (markdown.includes(prefix));
  return prefix;
}

interface ResolvedExportAssetUrl {
  url: string;
  embeddedBytes: number;
}

type ExportAssetUrlCache = Map<string, Promise<ResolvedExportAssetUrl>>;
interface ExportAssetBudget {
  embeddedBytes: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveAssetUrl(
  src: string,
  notesPath: string,
  notePath: string,
  remainingEmbeddedBytes: number,
  fallbackSrc = src,
): Promise<ResolvedExportAssetUrl> {
  const assetPath = getNoteInternalImageAssetPath(src);
  if (!assetPath || !notesPath || hasInternalNoteAssetUrlPathSegment(assetPath)) {
    return { url: fallbackSrc, embeddedBytes: 0 };
  }

  const bridge = getElectronBridge();
  if (!bridge) {
    return { url: fallbackSrc, embeddedBytes: 0 };
  }

  try {
    const absolutePath = await resolveExistingVaultAssetPath(notesPath, assetPath, notePath);
    if (!absolutePath) {
      return { url: fallbackSrc, embeddedBytes: 0 };
    }

    if (hasInternalNoteAssetUrlPathSegment(absolutePath) || !isExportableImagePath(absolutePath)) {
      return { url: fallbackSrc, embeddedBytes: 0 };
    }

    const fileInfo = await bridge.fs.stat(absolutePath).catch(() => null);
    const fileSize = fileInfo?.size;
    if (typeof fileSize !== 'number' || !isExportableImageSize(fileSize)) {
      return { url: fallbackSrc, embeddedBytes: 0 };
    }
    if (fileSize > MAX_EXPORT_EMBEDDED_IMAGE_BYTES) {
      return { url: fallbackSrc, embeddedBytes: 0 };
    }
    if (fileSize > remainingEmbeddedBytes) {
      return { url: fallbackSrc, embeddedBytes: 0 };
    }

    const bytes = await bridge.fs.readBinaryFile(absolutePath);
    if (!isExportableImageSize(bytes.byteLength)) {
      return { url: fallbackSrc, embeddedBytes: 0 };
    }
    if (bytes.byteLength > remainingEmbeddedBytes) {
      return { url: fallbackSrc, embeddedBytes: 0 };
    }

    return {
      url: `data:${getImageMimeType(absolutePath)};base64,${bytesToBase64(bytes)}`,
      embeddedBytes: Math.max(fileSize, bytes.byteLength),
    };
  } catch {
    return { url: fallbackSrc, embeddedBytes: 0 };
  }
}

function getExportAssetUrlCacheKey(src: string, notesPath: string, notePath: string, fallbackSrc: string): string {
  return JSON.stringify([src, notesPath, notePath, fallbackSrc]);
}

function consumeExportAssetBudget(
  asset: ResolvedExportAssetUrl,
  budget: ExportAssetBudget,
  fallbackSrc: string,
): string {
  if (asset.embeddedBytes <= 0) {
    return asset.url;
  }
  if (budget.embeddedBytes + asset.embeddedBytes > MAX_EXPORT_EMBEDDED_IMAGE_BYTES) {
    return fallbackSrc;
  }
  budget.embeddedBytes += asset.embeddedBytes;
  return asset.url;
}

async function resolveAssetUrlCached(
  cache: ExportAssetUrlCache,
  src: string,
  notesPath: string,
  notePath: string,
  budget: ExportAssetBudget,
  fallbackSrc = src,
): Promise<string> {
  const cacheKey = getExportAssetUrlCacheKey(src, notesPath, notePath, fallbackSrc);
  const cached = cache.get(cacheKey);
  if (cached) {
    return consumeExportAssetBudget(await cached, budget, fallbackSrc);
  }

  const remainingEmbeddedBytes = Math.max(0, MAX_EXPORT_EMBEDDED_IMAGE_BYTES - budget.embeddedBytes);
  const resolved = resolveAssetUrl(src, notesPath, notePath, remainingEmbeddedBytes, fallbackSrc);
  cache.set(cacheKey, resolved);
  return consumeExportAssetBudget(await resolved, budget, fallbackSrc);
}

export async function resolveExportMarkdownAssetSources(
  markdown: string,
  notesPath: string,
  notePath: string,
): Promise<string> {
  const segments: string[] = [];
  const markerPrefix = createExportSegmentMarkerPrefix(markdown);
  const protectedMarkdown = mapMarkdownOutsideProtectedSegments(markdown, (segment) => {
    const marker = `${markerPrefix}${segments.length}\0`;
    segments.push(segment);
    return marker;
  }, { protectHtmlBlocks: false });

  const assetUrlCache: ExportAssetUrlCache = new Map();
  const assetBudget: ExportAssetBudget = { embeddedBytes: 0 };
  const resolvedSegments: string[] = [];
  for (const segment of segments) {
    resolvedSegments.push(await resolveExportMarkdownAssetSegment(segment, notesPath, notePath, assetUrlCache, assetBudget));
  }

  const markerPattern = new RegExp(`${escapeRegExp(markerPrefix)}(\\d+)\\0`, 'g');
  return protectedMarkdown.replace(markerPattern, (_marker, rawIndex: string) => {
    const index = Number.parseInt(rawIndex, 10);
    return resolvedSegments[index] ?? '';
  });
}

async function resolveExportMarkdownAssetSegment(
  markdown: string,
  notesPath: string,
  notePath: string,
  assetUrlCache: ExportAssetUrlCache,
  assetBudget: ExportAssetBudget,
): Promise<string> {
  const tokens = findExportMarkdownAssetSourceTokensWithOptions(markdown, {
    maxTokens: MAX_EXPORT_MARKDOWN_ASSET_TOKENS,
  });
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
    parts.push(await resolveAssetUrlCached(assetUrlCache, token.lookupSrc ?? token.src, notesPath, notePath, assetBudget, token.src));
    cursor = token.end;
  }
  parts.push(markdown.slice(cursor));
  return parts.join('');
}
