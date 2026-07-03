import { loadImageAsBlob, loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import { resolveExistingNotesRootAssetPath } from '@/lib/assets/core/paths';
import { isPublicRemoteMediaUrl, sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';

interface ResolveCoverAssetUrlOptions {
  assetPath: string;
  notesRootPath: string;
  currentNotePath?: string;
  thumbnail?: boolean;
  thumbnailMaxEdgePx?: number;
  replayAnimated?: boolean;
}

interface PendingCoverAssetUrlResolve {
  promise: Promise<string>;
  startedAt: number;
}

interface CompletedCoverAssetUrlResolve {
  url: string;
  resolvedAt: number;
}

const pendingCoverAssetUrlResolves = new Map<string, PendingCoverAssetUrlResolve>();
const completedCoverAssetUrlResolves = new Map<string, CompletedCoverAssetUrlResolve>();
const displayedCoverAssetUrlResolves = new Map<string, string>();
const COVER_RESOLVE_JOIN_WINDOW_MS = 50;
const COVER_RESOLVE_REUSE_WINDOW_MS = 30_000;
export const MAX_PENDING_COVER_ASSET_URL_RESOLVES = 100;
const MAX_COMPLETED_COVER_ASSET_URL_RESOLVES = 500;
const MAX_DISPLAYED_COVER_ASSET_URL_RESOLVES = 500;
const ANIMATED_REPLAY_TOKEN_REUSE_WINDOW_MS = 500;
const MAX_ANIMATED_REPLAY_TOKEN_CACHE_ENTRIES = 500;
let animatedReplayTokenCounter = 0;

interface AnimatedReplayTokenEntry {
  token: string;
  createdAt: number;
}

const animatedReplayTokenCache = new Map<string, AnimatedReplayTokenEntry>();

export function clearCoverAssetUrlResolveCacheForTests(): void {
  pendingCoverAssetUrlResolves.clear();
  completedCoverAssetUrlResolves.clear();
  displayedCoverAssetUrlResolves.clear();
  animatedReplayTokenCache.clear();
}

export function shouldPreserveAssetAnimation(assetPath: string) {
  const pathname = assetPath.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  return pathname.endsWith('.gif') || pathname.endsWith('.apng') || pathname.endsWith('.webp');
}

function getNowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createAnimatedReplayToken(): string {
  animatedReplayTokenCounter += 1;
  return `${Date.now().toString(36)}-${animatedReplayTokenCounter.toString(36)}`;
}

function getAnimatedReplayToken(url: string): string {
  const now = getNowMs();
  const cached = animatedReplayTokenCache.get(url);
  if (cached && now - cached.createdAt <= ANIMATED_REPLAY_TOKEN_REUSE_WINDOW_MS) {
    animatedReplayTokenCache.delete(url);
    animatedReplayTokenCache.set(url, cached);
    return cached.token;
  }

  if (cached) {
    animatedReplayTokenCache.delete(url);
  }

  const entry = {
    token: createAnimatedReplayToken(),
    createdAt: now,
  };
  animatedReplayTokenCache.set(url, entry);

  while (animatedReplayTokenCache.size > MAX_ANIMATED_REPLAY_TOKEN_CACHE_ENTRIES) {
    const oldestKey = animatedReplayTokenCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    animatedReplayTokenCache.delete(oldestKey);
  }

  return entry.token;
}

function appendAnimatedReplayToken(url: string): string {
  const token = getAnimatedReplayToken(url);
  return `${url}${url.includes('#') ? '&' : '#'}vlaina-replay=${token}`;
}

function applyAnimatedReplayToken(url: string, assetPath: string, replayAnimated: boolean | undefined): string {
  return replayAnimated && shouldPreserveAssetAnimation(assetPath)
    ? appendAnimatedReplayToken(url)
    : url;
}

function getCoverResolveKey({
  assetPath,
  notesRootPath,
  currentNotePath,
  thumbnail,
  thumbnailMaxEdgePx,
}: ResolveCoverAssetUrlOptions) {
  return [
    thumbnail ? `thumb:${thumbnailMaxEdgePx ?? ''}` : 'full',
    notesRootPath,
    currentNotePath ?? '',
    assetPath,
  ].join('\0');
}

function getCompletedCoverAssetUrlResolve(resolveKey: string, now: number): string | null {
  const cached = completedCoverAssetUrlResolves.get(resolveKey);
  if (!cached) {
    return null;
  }

  if (now - cached.resolvedAt > COVER_RESOLVE_REUSE_WINDOW_MS) {
    completedCoverAssetUrlResolves.delete(resolveKey);
    return null;
  }

  completedCoverAssetUrlResolves.delete(resolveKey);
  completedCoverAssetUrlResolves.set(resolveKey, cached);
  return cached.url;
}

function setCompletedCoverAssetUrlResolve(resolveKey: string, url: string, now: number): void {
  completedCoverAssetUrlResolves.delete(resolveKey);
  completedCoverAssetUrlResolves.set(resolveKey, { url, resolvedAt: now });

  while (completedCoverAssetUrlResolves.size > MAX_COMPLETED_COVER_ASSET_URL_RESOLVES) {
    const oldestKey = completedCoverAssetUrlResolves.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    completedCoverAssetUrlResolves.delete(oldestKey);
  }
}

function getDisplayedCoverAssetUrlResolve(resolveKey: string): string | null {
  const displayedUrl = displayedCoverAssetUrlResolves.get(resolveKey);
  if (!displayedUrl) {
    return null;
  }

  displayedCoverAssetUrlResolves.delete(resolveKey);
  displayedCoverAssetUrlResolves.set(resolveKey, displayedUrl);
  return displayedUrl;
}

export async function resolveCoverAssetUrl({
  assetPath,
  notesRootPath,
  currentNotePath,
  thumbnail,
  thumbnailMaxEdgePx,
  replayAnimated,
}: ResolveCoverAssetUrlOptions): Promise<string> {
  const resolveKey = getCoverResolveKey({
    assetPath,
    notesRootPath,
    currentNotePath,
    thumbnail,
    thumbnailMaxEdgePx,
  });
  const pendingResolve = pendingCoverAssetUrlResolves.get(resolveKey);
  const now = getNowMs();
  const displayedResolve = replayAnimated ? getDisplayedCoverAssetUrlResolve(resolveKey) : null;
  if (displayedResolve) {
    return displayedResolve;
  }

  if (pendingResolve && now - pendingResolve.startedAt <= COVER_RESOLVE_JOIN_WINDOW_MS) {
    return applyAnimatedReplayToken(await pendingResolve.promise, assetPath, replayAnimated);
  }
  if (pendingResolve) {
    pendingCoverAssetUrlResolves.delete(resolveKey);
  }

  const completedResolve = getCompletedCoverAssetUrlResolve(resolveKey, now);
  if (completedResolve) {
    return applyAnimatedReplayToken(completedResolve, assetPath, replayAnimated);
  }

  if (pendingCoverAssetUrlResolves.size >= MAX_PENDING_COVER_ASSET_URL_RESOLVES) {
    throw new Error('cover-resolve-busy');
  }

  const resolvePromise = resolveCoverAssetUrlUncached({
    assetPath,
    notesRootPath,
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
    setCompletedCoverAssetUrlResolve(resolveKey, resolvedUrl, getNowMs());
    return applyAnimatedReplayToken(resolvedUrl, assetPath, replayAnimated);
  } finally {
    if (pendingCoverAssetUrlResolves.get(resolveKey)?.promise === resolvePromise) {
      pendingCoverAssetUrlResolves.delete(resolveKey);
    }
  }
}

export function getCachedResolvedCoverAssetUrl({
  assetPath,
  notesRootPath,
  currentNotePath,
  thumbnail,
  thumbnailMaxEdgePx,
  replayAnimated,
}: ResolveCoverAssetUrlOptions): string | null {
  const resolveKey = getCoverResolveKey({
    assetPath,
    notesRootPath,
    currentNotePath,
    thumbnail,
    thumbnailMaxEdgePx,
  });
  const displayedUrl = getDisplayedCoverAssetUrlResolve(resolveKey);
  if (displayedUrl) {
    return displayedUrl;
  }

  const resolvedUrl = getCompletedCoverAssetUrlResolve(resolveKey, getNowMs());
  if (resolvedUrl) {
    return applyAnimatedReplayToken(resolvedUrl, assetPath, replayAnimated);
  }

  return null;
}

export function rememberDisplayedCoverAssetUrl({
  assetPath,
  notesRootPath,
  currentNotePath,
  thumbnail,
  thumbnailMaxEdgePx,
}: ResolveCoverAssetUrlOptions, resolvedUrl: string): void {
  const resolveKey = getCoverResolveKey({
    assetPath,
    notesRootPath,
    currentNotePath,
    thumbnail,
    thumbnailMaxEdgePx,
  });
  displayedCoverAssetUrlResolves.delete(resolveKey);
  displayedCoverAssetUrlResolves.set(resolveKey, resolvedUrl);

  while (displayedCoverAssetUrlResolves.size > MAX_DISPLAYED_COVER_ASSET_URL_RESOLVES) {
    const oldestKey = displayedCoverAssetUrlResolves.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    displayedCoverAssetUrlResolves.delete(oldestKey);
  }
}

async function resolveCoverAssetUrlUncached({
  assetPath,
  notesRootPath,
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

  if (!notesRootPath) {
    throw new Error('notes-root-path-required');
  }

  const fullPath = await resolveExistingNotesRootAssetPath(notesRootPath, safeAssetPath, currentNotePath);
  if (!fullPath) {
    throw new Error('cover-path-unsupported');
  }
  if (hasInternalNoteAssetUrlPathSegment(fullPath)) {
    throw new Error('cover-path-unsupported');
  }
  const loadResolvedAsset = (resolvedPath: string) => {
    if (!thumbnail) {
      return loadImageAsBlob(resolvedPath);
    }
    return thumbnailMaxEdgePx
      ? loadImageThumbnailAsBlob(resolvedPath, {
        maxEdgePx: thumbnailMaxEdgePx,
        allowMainThreadFallback: false,
      })
      : loadImageThumbnailAsBlob(resolvedPath);
  };

  try {
    return await loadResolvedAsset(fullPath);
  } catch (error) {
    const fallbackAssetPath = safeAssetPath.startsWith('./assets/')
      ? safeAssetPath.slice(2)
      : null;
    if (!fallbackAssetPath) {
      throw error;
    }

    const fallbackFullPath = await resolveExistingNotesRootAssetPath(notesRootPath, fallbackAssetPath, currentNotePath);
    if (!fallbackFullPath || fallbackFullPath === fullPath || hasInternalNoteAssetUrlPathSegment(fallbackFullPath)) {
      throw error;
    }

    return loadResolvedAsset(fallbackFullPath);
  }
}
