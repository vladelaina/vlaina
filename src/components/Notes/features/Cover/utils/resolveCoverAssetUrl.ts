import { loadImageAsBlob, loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { isPublicRemoteMediaUrl, sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';

interface ResolveCoverAssetUrlOptions {
  assetPath: string;
  vaultPath: string;
  currentNotePath?: string;
  thumbnail?: boolean;
  thumbnailMaxEdgePx?: number;
}

interface PendingCoverAssetUrlResolve {
  promise: Promise<string>;
  startedAt: number;
}

const pendingCoverAssetUrlResolves = new Map<string, PendingCoverAssetUrlResolve>();
const COVER_RESOLVE_JOIN_WINDOW_MS = 50;

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
    return pendingResolve.promise;
  }
  if (pendingResolve) {
    pendingCoverAssetUrlResolves.delete(resolveKey);
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
    return await resolvePromise;
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
  if (isBuiltinCover(assetPath)) {
    return getBuiltinCoverUrl(assetPath);
  }

  const safeAssetPath = sanitizeNoteMediaSrc(assetPath);
  if (!safeAssetPath || safeAssetPath.startsWith('blob:')) {
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
