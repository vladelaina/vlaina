import { loadImageAsBlob, loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { isPublicRemoteMediaUrl, sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';

interface ResolveCoverAssetUrlOptions {
  assetPath: string;
  vaultPath: string;
  currentNotePath?: string;
  thumbnail?: boolean;
  thumbnailMaxEdgePx?: number;
  replayAnimated?: boolean;
}

interface PendingCoverAssetUrlResolve {
  promise: Promise<string>;
  startedAt: number;
}

const pendingCoverAssetUrlResolves = new Map<string, PendingCoverAssetUrlResolve>();
const COVER_RESOLVE_JOIN_WINDOW_MS = 50;
export const MAX_PENDING_COVER_ASSET_URL_RESOLVES = 100;
let animatedReplayTokenCounter = 0;

export function shouldPreserveAssetAnimation(assetPath: string) {
  const pathname = assetPath.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  return pathname.endsWith('.gif') || pathname.endsWith('.apng') || pathname.endsWith('.webp');
}

function appendAnimatedReplayToken(url: string): string {
  animatedReplayTokenCounter += 1;
  const token = `${Date.now().toString(36)}-${animatedReplayTokenCounter.toString(36)}`;
  return `${url}${url.includes('#') ? '&' : '#'}vlaina-replay=${token}`;
}

function applyAnimatedReplayToken(url: string, assetPath: string, replayAnimated: boolean | undefined): string {
  return replayAnimated && shouldPreserveAssetAnimation(assetPath)
    ? appendAnimatedReplayToken(url)
    : url;
}

function getCoverResolveKey({
  assetPath,
  vaultPath,
  currentNotePath,
  thumbnail,
  thumbnailMaxEdgePx,
}: ResolveCoverAssetUrlOptions) {
  return [
    thumbnail ? `thumb:${thumbnailMaxEdgePx ?? ''}` : 'full',
    vaultPath,
    currentNotePath ?? '',
    assetPath,
  ].join('\0');
}

export async function resolveCoverAssetUrl({
  assetPath,
  vaultPath,
  currentNotePath,
  thumbnail,
  thumbnailMaxEdgePx,
  replayAnimated,
}: ResolveCoverAssetUrlOptions): Promise<string> {
  const resolveKey = getCoverResolveKey({
    assetPath,
    vaultPath,
    currentNotePath,
    thumbnail,
    thumbnailMaxEdgePx,
  });
  const pendingResolve = pendingCoverAssetUrlResolves.get(resolveKey);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (pendingResolve && now - pendingResolve.startedAt <= COVER_RESOLVE_JOIN_WINDOW_MS) {
    return applyAnimatedReplayToken(await pendingResolve.promise, assetPath, replayAnimated);
  }
  if (pendingResolve) {
    pendingCoverAssetUrlResolves.delete(resolveKey);
  }
  if (pendingCoverAssetUrlResolves.size >= MAX_PENDING_COVER_ASSET_URL_RESOLVES) {
    throw new Error('cover-resolve-busy');
  }

  const resolvePromise = resolveCoverAssetUrlUncached({
    assetPath,
    vaultPath,
    currentNotePath,
    thumbnail,
    thumbnailMaxEdgePx,
  });
  pendingCoverAssetUrlResolves.set(resolveKey, {
    promise: resolvePromise,
    startedAt: now,
  });
  try {
    const resolvedUrl = await resolvePromise;
    return applyAnimatedReplayToken(resolvedUrl, assetPath, replayAnimated);
  } finally {
    if (pendingCoverAssetUrlResolves.get(resolveKey)?.promise === resolvePromise) {
      pendingCoverAssetUrlResolves.delete(resolveKey);
    }
  }
}

async function resolveCoverAssetUrlUncached({
  assetPath,
  vaultPath,
  currentNotePath,
  thumbnail,
  thumbnailMaxEdgePx,
}: ResolveCoverAssetUrlOptions): Promise<string> {
  const safeAssetPath = sanitizeNoteMediaSrc(assetPath);
  if (!safeAssetPath || /^blob:/i.test(safeAssetPath)) {
    throw new Error('cover-path-unsupported');
  }
  if (hasInternalNoteAssetUrlPathSegment(safeAssetPath)) {
    throw new Error('cover-path-unsupported');
  }
  if (isPublicRemoteMediaUrl(safeAssetPath)) {
    throw new Error('remote-cover-unsupported');
  }

  if (!vaultPath) {
    throw new Error('vault-path-required');
  }

  const fullPath = await resolveExistingVaultAssetPath(vaultPath, safeAssetPath, currentNotePath);
  if (!fullPath) {
    throw new Error('cover-path-unsupported');
  }
  if (hasInternalNoteAssetUrlPathSegment(fullPath)) {
    throw new Error('cover-path-unsupported');
  }
  if (!thumbnail) {
    return loadImageAsBlob(fullPath);
  }
  return thumbnailMaxEdgePx
    ? loadImageThumbnailAsBlob(fullPath, {
      maxEdgePx: thumbnailMaxEdgePx,
      allowMainThreadFallback: false,
    })
    : loadImageThumbnailAsBlob(fullPath);
}
