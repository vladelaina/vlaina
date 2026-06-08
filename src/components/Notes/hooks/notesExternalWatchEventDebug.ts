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
    const expectedChange =
      relativePath != null &&
      !ignoredByVaultRules &&
      shouldIgnoreExpectedExternalChange(normalizedPath);
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
    detail.expectedChange || detail.ignoredByVaultRules ? '' : detail.normalizedPath
  );

  return {
    pathDetails,
    unexpectedPaths,
  };
}

export function hasBlockedRenameEndpoint(
  event: { type: unknown },
  pathDetails: ReturnType<typeof classifyWatchEventPaths>['pathDetails']
): boolean {
  if (typeof event.type === 'string' || !event.type || typeof event.type !== 'object' || !('modify' in event.type)) {
    return false;
  }

  const modify = event.type.modify;
  if (!modify || typeof modify !== 'object' || !('kind' in modify) || modify.kind !== 'rename') {
    return false;
  }

  const isBlockedEndpoint = (index: number) => {
    const detail = pathDetails[index];
    return !!detail && (detail.expectedChange || detail.ignoredByVaultRules);
  };

  if ('mode' in modify && (modify.mode === 'from' || modify.mode === 'to')) {
    return isBlockedEndpoint(0);
  }

  return isBlockedEndpoint(0) || isBlockedEndpoint(1);
}
