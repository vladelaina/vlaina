import { shouldIgnoreExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import {
  isIgnoredWatchPath,
  normalizeFsPath,
  toVaultRelativePath,
} from './notesExternalSyncUtils';

export function classifyWatchEventPaths(vaultPath: string, paths: string[]) {
  const pathDetails = paths.map((path) => {
    const normalizedPath = normalizeFsPath(path);
    const relativePath = toVaultRelativePath(vaultPath, normalizedPath);
    const ignoredByVaultRules = relativePath != null && isIgnoredWatchPath(relativePath);
    const expectedChange = shouldIgnoreExpectedExternalChange(normalizedPath);
    return {
      path,
      normalizedPath,
      relativePath,
      insideVault: relativePath != null,
      ignoredByVaultRules,
      expectedChange,
    };
  });
  const unexpectedPaths = pathDetails.map((detail) =>
    detail.expectedChange ? '' : detail.normalizedPath
  );

  return {
    pathDetails,
    unexpectedPaths,
  };
}
