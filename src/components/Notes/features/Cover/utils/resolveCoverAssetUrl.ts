import { loadImageAsBlob, loadImageThumbnailAsBlob } from '@/lib/assets/io/reader';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { isPublicRemoteMediaUrl, sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';
import { logNotesDebugAlways } from '@/stores/notes/lineBreakDebugLog';

interface ResolveCoverAssetUrlOptions {
  assetPath: string;
  vaultPath: string;
  currentNotePath?: string;
  thumbnail?: boolean;
}

function logCoverResolve(scope: string, payload?: unknown) {
  logNotesDebugAlways('NotesCoverResolve', scope, payload);
}

export async function resolveCoverAssetUrl({
  assetPath,
  vaultPath,
  currentNotePath,
  thumbnail,
}: ResolveCoverAssetUrlOptions): Promise<string> {
  logCoverResolve('start', { assetPath, vaultPath, currentNotePath });
  if (isBuiltinCover(assetPath)) {
    const builtinUrl = getBuiltinCoverUrl(assetPath);
    logCoverResolve('builtin', { assetPath, builtinUrl });
    return builtinUrl;
  }

  const safeAssetPath = sanitizeNoteMediaSrc(assetPath);
  if (!safeAssetPath || safeAssetPath.startsWith('blob:')) {
    throw new Error('cover-path-unsupported');
  }
  if (isPublicRemoteMediaUrl(safeAssetPath)) {
    throw new Error('remote-cover-unsupported');
  }

  if (!vaultPath) {
    logCoverResolve('missing-vault', { assetPath });
    throw new Error('vault-path-required');
  }

  const fullPath = await resolveExistingVaultAssetPath(vaultPath, safeAssetPath, currentNotePath);
  if (!fullPath) {
    logCoverResolve('unsupported-path', { assetPath, safeAssetPath, vaultPath, currentNotePath });
    throw new Error('cover-path-unsupported');
  }
  logCoverResolve('resolved-file', { assetPath, safeAssetPath, fullPath });
  return thumbnail ? loadImageThumbnailAsBlob(fullPath) : loadImageAsBlob(fullPath);
}
