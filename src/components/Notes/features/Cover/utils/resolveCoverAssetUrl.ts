import { loadImageAsBlob } from '@/lib/assets/io/reader';
import { resolveSystemAssetPath } from '@/lib/assets/core/paths';
import { isBuiltinCover, getBuiltinCoverUrl } from '@/lib/assets/builtinCovers';

interface ResolveCoverAssetUrlOptions {
  assetPath: string;
  vaultPath: string;
  localCategory?: 'covers' | 'icons' | 'auto';
}

function resolveLocalCategory(assetPath: string, localCategory: 'covers' | 'icons' | 'auto'): 'covers' | 'icons' {
  if (localCategory === 'auto') {
    return assetPath.startsWith('icons/') ? 'icons' : 'covers';
  }
  return localCategory;
}

export async function resolveCoverAssetUrl({
  assetPath,
  vaultPath,
  localCategory = 'covers',
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

  const category = resolveLocalCategory(assetPath, localCategory);
  const fullPath = await resolveSystemAssetPath(vaultPath, assetPath, category);
  return loadImageAsBlob(fullPath);
}
