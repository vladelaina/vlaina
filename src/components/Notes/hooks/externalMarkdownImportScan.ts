import { getElectronBridge } from '@/lib/electron/bridge';
import { getBaseName, getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import {
  isPathInsideStarredNotesRoot,
  isValidStarredNotesRootPath,
  normalizeStarredRelativePath,
  resolveStarredRelativePathForNotesRoot,
} from '@/stores/notes/starred';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  hasUnsafeNotesRootPathSegment,
  isSafeNotesRootPathSegment,
} from '@/stores/notes/utils/fs/notesRootPathContainment';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import {
  MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES,
  type ExternalMarkdownStarredTarget,
} from './externalMarkdownImportTypes';

const EXPLICIT_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const BACKSLASH_ESCAPED_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*\\+:/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const LOW_PRIORITY_EXTERNAL_MARKDOWN_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

function isLowPriorityExternalMarkdownDirectory(name: string) {
  return LOW_PRIORITY_EXTERNAL_MARKDOWN_DIRECTORY_NAMES.has(name.toLowerCase());
}

export function prioritizeExternalMarkdownScanEntries<T>(
  entries: readonly T[],
  getPriority: (entry: T) => number,
  maxEntries = entries.length,
): T[] {
  const limit = Math.max(0, Math.floor(maxEntries));
  if (limit === 0) {
    return [];
  }

  const buckets = new Map<number, T[]>();
  let retainedEntries = 0;
  let worstPriority: number | null = null;

  const updateWorstPriority = () => {
    worstPriority = null;
    for (const priority of buckets.keys()) {
      if (worstPriority === null || priority > worstPriority) {
        worstPriority = priority;
      }
    }
  };

  for (const entry of entries) {
    const priority = getPriority(entry);

    if (retainedEntries >= limit) {
      if (worstPriority === null || priority >= worstPriority) {
        continue;
      }

      const worstBucket = buckets.get(worstPriority);
      worstBucket?.pop();
      if (worstBucket?.length === 0) {
        buckets.delete(worstPriority);
      }
    } else {
      retainedEntries += 1;
    }

    const bucket = buckets.get(priority);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(priority, [entry]);
    }
    updateWorstPriority();
  }

  const prioritized: T[] = [];
  for (const priority of Array.from(buckets.keys()).sort((left, right) => left - right)) {
    for (const entry of buckets.get(priority) ?? []) {
      if (prioritized.length >= limit) {
        return prioritized;
      }
      prioritized.push(entry);
    }
  }
  return prioritized;
}

export function getExternalMarkdownPriorityScanLimit(scannedEntries: number, maxScanEntries: number) {
  const remainingEntries = Math.max(0, maxScanEntries - scannedEntries);
  return Math.min(MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES, remainingEntries * 2);
}

export function getExternalMarkdownAbsolutePathPriority(path: string) {
  const baseName = getBaseName(path).trim();
  if (!baseName) {
    return 2;
  }
  if (isSupportedMarkdownSelection(path)) {
    return 0;
  }
  if (baseName.lastIndexOf('.') <= 0) {
    return 1;
  }
  return 2;
}

export function getExternalMarkdownDirectoryEntryPriority(entry: {
  name: string;
  isDirectory?: boolean;
  isFile?: boolean;
}) {
  if (!isSafeNotesRootPathSegment(entry.name)) {
    return 3;
  }
  if (entry.isFile && isSupportedMarkdownSelection(entry.name)) {
    return 0;
  }
  if (entry.isDirectory && !isLowPriorityExternalMarkdownDirectory(entry.name)) {
    return 1;
  }
  if (entry.isDirectory) {
    return 2;
  }
  return 3;
}

function isInsideInternalExternalMarkdownPath(path: string) {
  return hasInternalNotePathSegment(path);
}

function isBlankExternalMarkdownPath(path: string) {
  return path.trim().length === 0;
}

function hasExplicitExternalMarkdownNonPathScheme(path: string) {
  const trimmed = path.trim();
  return (
    (EXPLICIT_URL_SCHEME_PATTERN.test(trimmed) && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)) ||
    BACKSLASH_ESCAPED_SCHEME_PATTERN.test(trimmed)
  );
}

function hasUnsafeExternalMarkdownPathSegment(path: string) {
  const normalizedPath = path.replace(/\\/g, '/');
  const pathWithoutDrive = /^[A-Za-z]:(?:\/|$)/.test(normalizedPath)
    ? normalizedPath.slice(2)
    : normalizedPath;
  return hasUnsafeNotesRootPathSegment(pathWithoutDrive);
}

export function isAllowedExternalMarkdownPath(path: string) {
  return !(
    isBlankExternalMarkdownPath(path) ||
    hasExplicitExternalMarkdownNonPathScheme(path) ||
    !isAbsolutePath(path) ||
    isInsideInternalExternalMarkdownPath(path) ||
    hasUnsafeExternalMarkdownPathSegment(path)
  );
}

export function getAuthorizedExternalMarkdownPath(
  info: { path?: string | null } | null | undefined,
  fallbackPath: string,
) {
  const authorizedPath = info?.path?.trim();
  return authorizedPath || fallbackPath;
}

export async function statExternalMarkdownPath(absolutePath: string) {
  const dragDrop = getElectronBridge()?.dragDrop;
  if (dragDrop) {
    return dragDrop.authorizePath(absolutePath);
  }

  return getStorageAdapter().stat(absolutePath);
}

export function getExistingNotesRootRelativePath(notesRootPath: string, absolutePath: string) {
  return resolveStarredRelativePathForNotesRoot(absolutePath, notesRootPath);
}

export function createExternalStarredTarget(
  info: { isDirectory?: boolean; isFile?: boolean },
  notesRootPath: string,
  relativePath: string,
): ExternalMarkdownStarredTarget | null {
  if (!isValidStarredNotesRootPath(notesRootPath)) {
    return null;
  }

  const normalizedRelativePath = normalizeStarredRelativePath(relativePath);
  if (!normalizedRelativePath) {
    return null;
  }

  return {
    kind: info.isDirectory ? 'folder' : 'note',
    notesRootPath,
    relativePath: normalizedRelativePath,
  };
}

export { isPathInsideStarredNotesRoot };
