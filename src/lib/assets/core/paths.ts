import { getParentPath, getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';

export async function resolveVaultAssetPath(
  vaultPath: string,
  assetPath: string,
  currentNotePath?: string,
): Promise<string> {
  const candidates = await resolveVaultAssetPathCandidates(vaultPath, assetPath, currentNotePath);
  return candidates[0] ?? '';
}

export async function resolveExistingVaultAssetPath(
  vaultPath: string,
  assetPath: string,
  currentNotePath?: string,
): Promise<string> {
  const candidates = await resolveVaultAssetPathCandidates(vaultPath, assetPath, currentNotePath);
  if (candidates.length <= 1) {
    return candidates[0] ?? '';
  }

  const storage = getStorageAdapter();
  for (const candidate of candidates) {
    if (await storage.exists(candidate).catch(() => false)) {
      return candidate;
    }
  }

  return candidates[0] ?? '';
}

export async function resolveVaultAssetPathCandidates(
  vaultPath: string,
  assetPath: string,
  currentNotePath?: string,
): Promise<string[]> {
  if (isAbsolutePath(assetPath)) {
    return [assetPath];
  }

  const currentNoteDir = currentNotePath
    ? getParentPath(
        isAbsolutePath(currentNotePath)
          ? currentNotePath
          : await joinPath(vaultPath, currentNotePath)
      )
    : null;

  if (assetPath.startsWith('./') || assetPath.startsWith('../')) {
    return [await joinPath(currentNoteDir ?? vaultPath, assetPath)];
  }

  const candidates: string[] = [];

  if (currentNoteDir) {
    candidates.push(await joinPath(currentNoteDir, assetPath));
  }

  const vaultAssetPath = await joinPath(vaultPath, assetPath);
  if (!candidates.includes(vaultAssetPath)) {
    candidates.push(vaultAssetPath);
  }

  return candidates;
}

export async function joinPaths(...paths: string[]): Promise<string> {
  return joinPath(...paths);
}

export async function getDirname(path: string): Promise<string> {
  return getParentPath(path) || '/';
}
