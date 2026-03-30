import { normalizeNotePathKey } from '@/lib/notes/displayName';

export function isInvalidMoveTarget(sourcePath: string, targetFolderPath: string): boolean {
  const normalizedSourcePath = normalizeNotePathKey(sourcePath) ?? sourcePath;
  const normalizedTargetFolderPath = normalizeNotePathKey(targetFolderPath) ?? targetFolderPath;

  if (!normalizedSourcePath || !normalizedTargetFolderPath) {
    return false;
  }

  return (
    normalizedSourcePath === normalizedTargetFolderPath ||
    normalizedTargetFolderPath.startsWith(`${normalizedSourcePath}/`)
  );
}
