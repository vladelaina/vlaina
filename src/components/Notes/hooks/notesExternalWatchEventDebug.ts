import { shouldIgnoreExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import {
  isIgnoredWatchPath,
  normalizeFsPath,
  toNotesRootRelativePath,
} from './notesExternalSyncUtils';

export function classifyWatchEventPaths(notesRootPath: string, paths: string[]) {
  const pathDetails = paths.map((path) => {
    const normalizedPath = normalizeFsPath(path);
    const relativePath = toNotesRootRelativePath(notesRootPath, normalizedPath);
    const ignoredByNotesRootRules = relativePath != null && isIgnoredWatchPath(relativePath);
    const expectedChange =
      relativePath != null &&
      !ignoredByNotesRootRules &&
      shouldIgnoreExpectedExternalChange(normalizedPath);
    return {
      path,
      normalizedPath,
      relativePath,
      insideNotesRoot: relativePath != null,
      ignoredByNotesRootRules,
      expectedChange,
    };
  });
  const unexpectedPaths = pathDetails.map((detail) =>
    detail.expectedChange || detail.ignoredByNotesRootRules ? '' : detail.normalizedPath
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
    return !!detail && (detail.expectedChange || detail.ignoredByNotesRootRules);
  };

  if ('mode' in modify && (modify.mode === 'from' || modify.mode === 'to')) {
    return isBlockedEndpoint(0);
  }

  return isBlockedEndpoint(0) || isBlockedEndpoint(1);
}
