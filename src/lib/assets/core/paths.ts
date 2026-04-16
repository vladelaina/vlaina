import { getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';

export async function resolveVaultAssetPath(
  vaultPath: string,
  assetPath: string,
  currentNotePath?: string,
): Promise<string> {
  if (isAbsolutePath(assetPath)) {
    return assetPath;
  }

  const currentNoteDir = currentNotePath
    ? getParentPath(
        isAbsolutePath(currentNotePath)
          ? currentNotePath
          : await joinPath(vaultPath, currentNotePath)
      )
    : null;

  if (assetPath.startsWith('./') || assetPath.startsWith('../')) {
    return joinPath(currentNoteDir ?? vaultPath, assetPath);
  }

  return currentNoteDir
    ? joinPath(currentNoteDir, assetPath)
    : joinPath(vaultPath, assetPath);
}

export async function joinPaths(...paths: string[]): Promise<string> {
  return joinPath(...paths);
}

export async function getDirname(path: string): Promise<string> {
  return getParentPath(path) || '/';
}
