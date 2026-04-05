import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { getParentPath } from './pathOperations';

export function isInvalidMoveTarget(sourcePath: string, targetFolderPath: string): boolean {
  const normalizedSourcePath = normalizeNotePathKey(sourcePath) ?? sourcePath;
  const normalizedTargetFolderPath = normalizeNotePathKey(targetFolderPath) ?? targetFolderPath;
  const sourceParentPath = getParentPath(normalizedSourcePath);

  if (normalizedSourcePath && sourceParentPath === normalizedTargetFolderPath) {
    return true;
  }

  if (!normalizedSourcePath || !normalizedTargetFolderPath) {
    return false;
  }

  return (
    normalizedSourcePath === normalizedTargetFolderPath ||
    normalizedTargetFolderPath.startsWith(`${normalizedSourcePath}/`)
  );
}
