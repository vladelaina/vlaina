import { getParentPath, getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from './pathContainment';

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
    return [];
  }

  const currentNoteDir = currentNotePath
    ? getParentPath(
        isAbsolutePath(currentNotePath)
          ? currentNotePath
          : await joinPath(vaultPath, currentNotePath)
      )
    : null;
  const isAbsoluteExternalNote = Boolean(
    currentNotePath
    && isAbsolutePath(currentNotePath)
    && currentNoteDir
    && !normalizeContainedAssetPath(currentNotePath, vaultPath)
  );
  const currentNoteAssetRoot = isAbsoluteExternalNote && currentNoteDir
    ? currentNoteDir
    : vaultPath;

  if (assetPath.startsWith('./') || assetPath.startsWith('../')) {
    const candidate = normalizeContainedAssetPath(
      await joinPath(currentNoteDir ?? vaultPath, assetPath),
      currentNoteAssetRoot,
    );
    return candidate ? [candidate] : [];
  }

  const candidates: string[] = [];

  if (currentNoteDir) {
    const noteRelativeCandidate = normalizeContainedAssetPath(
      await joinPath(currentNoteDir, assetPath),
      currentNoteAssetRoot,
    );
    if (noteRelativeCandidate) {
      candidates.push(noteRelativeCandidate);
    }
  }

  const vaultAssetPath = normalizeContainedAssetPath(await joinPath(vaultPath, assetPath), vaultPath);
  if (vaultAssetPath && !candidates.includes(vaultAssetPath)) {
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
