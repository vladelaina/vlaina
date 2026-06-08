import { getParentPath, getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { normalizeContainedAssetPath } from './pathContainment';
import { hasInternalNoteAssetPathSegment } from './internalAssetPaths';

const EXPLICIT_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const MAX_LOCAL_ASSET_PATH_CHARS = 16 * 1024;

function getLocalAssetPath(assetPath: string): string {
  return assetPath.split(/[?#]/, 1)[0] ?? '';
}

function isSafeRelativeAssetPath(assetPath: string): boolean {
  const trimmed = assetPath.trim();
  return (
    trimmed === assetPath
    && trimmed.length > 0
    && trimmed.length <= MAX_LOCAL_ASSET_PATH_CHARS
    && !CONTROL_OR_BIDI_PATTERN.test(trimmed)
    && !trimmed.startsWith('\\')
    && !trimmed.startsWith('//')
    && !EXPLICIT_URL_SCHEME_PATTERN.test(trimmed)
    && !isAbsolutePath(trimmed)
    && !hasInternalNoteAssetPathSegment(trimmed)
  );
}

function addNonInternalCandidate(candidates: string[], candidate: string | null): void {
  if (!candidate || hasInternalNoteAssetPathSegment(candidate) || candidates.includes(candidate)) {
    return;
  }

  candidates.push(candidate);
}

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
  if (hasInternalNoteAssetPathSegment(currentNotePath)) {
    return [];
  }

  const localAssetPath = getLocalAssetPath(assetPath);
  if (!isSafeRelativeAssetPath(localAssetPath)) {
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

  if (localAssetPath.startsWith('./') || localAssetPath.startsWith('../')) {
    const candidate = normalizeContainedAssetPath(
      await joinPath(currentNoteDir ?? vaultPath, localAssetPath),
      currentNoteAssetRoot,
    );
    return candidate && !hasInternalNoteAssetPathSegment(candidate) ? [candidate] : [];
  }

  const candidates: string[] = [];

  if (currentNoteDir) {
    const noteRelativeCandidate = normalizeContainedAssetPath(
      await joinPath(currentNoteDir, localAssetPath),
      currentNoteAssetRoot,
    );
    addNonInternalCandidate(candidates, noteRelativeCandidate);
  }

  const vaultAssetPath = normalizeContainedAssetPath(await joinPath(vaultPath, localAssetPath), vaultPath);
  addNonInternalCandidate(candidates, vaultAssetPath);

  return candidates;
}

export async function joinPaths(...paths: string[]): Promise<string> {
  return joinPath(...paths);
}

export async function getDirname(path: string): Promise<string> {
  return getParentPath(path) || '/';
}
