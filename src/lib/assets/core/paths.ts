import { getParentPath, joinPath } from '@/lib/storage/adapter';

export async function resolveSystemAssetPath(
  vaultPath: string, 
  filename: string, 
  category: 'covers' | 'icons'
): Promise<string> {
  const assetsBaseDir = await joinPath(vaultPath, '.vlaina', 'assets');
  
  if (category === 'icons') {
    const name = filename.replace(/^icons[\\/]/, '');
    return joinPath(assetsBaseDir, 'icons', name);
  } else {
    return joinPath(assetsBaseDir, 'covers', filename);
  }
}

export async function joinPaths(...paths: string[]): Promise<string> {
  return joinPath(...paths);
}

export async function getDirname(path: string): Promise<string> {
  return getParentPath(path) || '/';
}
