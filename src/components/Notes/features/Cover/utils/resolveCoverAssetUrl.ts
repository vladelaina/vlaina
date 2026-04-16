import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveVaultAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';

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
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    throw new Error('remote-cover-unsupported');
  }

  if (isBuiltinCover(assetPath)) {
    return getBuiltinCoverUrl(assetPath);
  }

  if (!vaultPath) {
    throw new Error('vault-path-required');
  }

  const fullPath = await resolveVaultAssetPath(vaultPath, assetPath, currentNotePath);
  return loadImageAsBlob(fullPath);
}
