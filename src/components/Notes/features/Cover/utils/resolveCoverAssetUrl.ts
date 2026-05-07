import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveExistingVaultAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';
import { isPublicRemoteMediaUrl, sanitizeNoteMediaSrc } from '@/lib/notes/markdown/urlSecurity';

interface ResolveCoverAssetUrlOptions {
  assetPath: string;
  vaultPath: string;
  currentNotePath?: string;
}

export async function resolveCoverAssetUrl({
  assetPath,
  vaultPath,
  currentNotePath,
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
  return loadImageAsBlob(fullPath);
}
