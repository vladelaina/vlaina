import { getElectronBridge } from '@/lib/electron/bridge';
import { getBaseName, getParentPath, getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import type { StarredKind } from '@/stores/notes/types';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import {
  isPathInsideStarredNotesRoot,
  isValidStarredNotesRootPath,
  normalizeStarredRelativePath,
  resolveStarredRelativePathForNotesRoot,
} from '@/stores/notes/starred';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { resolveUniquePath } from '@/stores/notes/utils/fs/pathOperations';
import {
  hasUnsafeNotesRootPathSegment,
  isSafeNotesRootPathSegment,
} from '@/stores/notes/utils/fs/notesRootPathContainment';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';

const MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES = 2000;
const MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES = 10_000;
const MAX_EXTERNAL_MARKDOWN_STARRED_SCAN_ENTRIES = 10_000;
const MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES = MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES * 2;
const MAX_EXTERNAL_MARKDOWN_IMPORT_DEPTH = 24;
const MAX_EXTERNAL_MARKDOWN_FILE_SIZE = 10 * 1024 * 1024;
const externalMarkdownImportUtf8Encoder = new TextEncoder();
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
interface ExternalMarkdownImportResult {
  importedNotePaths: string[];
  importedFolderPaths: string[];
  didImport: boolean;
}

export interface ExternalMarkdownStarredTarget {
  kind: StarredKind;
  notesRootPath: string;
  relativePath: string;
}

interface ExternalMarkdownImportBudget {
  scannedEntries: number;
  visitedEntries: number;
}

interface PreparedExternalMarkdownFileImport {
  contentToWrite: string | null;
}

function shouldHideExternalMarkdownDirectory(name: string) {
  return hasInternalNotePathSegment(name);
}

function isLowPriorityExternalMarkdownDirectory(name: string) {
  return LOW_PRIORITY_EXTERNAL_MARKDOWN_DIRECTORY_NAMES.has(name.toLowerCase());
}

function isExternalMarkdownContentWithinReadLimit(content: string): boolean {
  return (
    content.length <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE &&
    externalMarkdownImportUtf8Encoder.encode(content).length <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE
  );
}

function isKnownExternalMarkdownFileSizeWithinLimit(size: number): boolean {
  return (
    Number.isFinite(size) &&
    size >= 0 &&
    size <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE
  );
}

function hasInvalidExternalMarkdownFileSize(
  info: { size?: number | null } | null | undefined,
): boolean {
  return typeof info?.size === 'number' && !isKnownExternalMarkdownFileSizeWithinLimit(info.size);
}

function prioritizeExternalMarkdownScanEntries<T>(
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

function getExternalMarkdownPriorityScanLimit(scannedEntries: number, maxScanEntries: number) {
  const remainingEntries = Math.max(0, maxScanEntries - scannedEntries);
  return Math.min(MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES, remainingEntries * 2);
}

function getExternalMarkdownAbsolutePathPriority(path: string) {
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

function getExternalMarkdownDirectoryEntryPriority(entry: {
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

function isAllowedExternalMarkdownPath(path: string) {
  return !(
    isBlankExternalMarkdownPath(path) ||
    hasExplicitExternalMarkdownNonPathScheme(path) ||
    !isAbsolutePath(path) ||
    isInsideInternalExternalMarkdownPath(path) ||
    hasUnsafeExternalMarkdownPathSegment(path)
  );
}

function getAuthorizedExternalMarkdownPath(
  info: { path?: string | null } | null | undefined,
  fallbackPath: string,
) {
  const authorizedPath = info?.path?.trim();
  return authorizedPath || fallbackPath;
}

function spendExternalMarkdownScanBudget(budget: ExternalMarkdownImportBudget): boolean {
  if (budget.scannedEntries >= MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES) {
    return false;
  }
  budget.scannedEntries += 1;
  return true;
}

async function statExternalMarkdownPath(absolutePath: string) {
  const dragDrop = getElectronBridge()?.dragDrop;
  if (dragDrop) {
    return dragDrop.authorizePath(absolutePath);
  }

  return getStorageAdapter().stat(absolutePath);
}

function getExistingNotesRootRelativePath(notesRootPath: string, absolutePath: string) {
  return resolveStarredRelativePathForNotesRoot(absolutePath, notesRootPath);
}

function createExternalStarredTarget(
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

async function importExternalMarkdownFile(
  sourcePath: string,
  notesRootPath: string,
  targetFolderPath: string | undefined,
  preparedImport: PreparedExternalMarkdownFileImport,
) {
  const storage = getStorageAdapter();
  let resolvedPath: Awaited<ReturnType<typeof resolveUniquePath>>;
  try {
    resolvedPath = await resolveUniquePath(
      notesRootPath,
      targetFolderPath,
      getBaseName(sourcePath),
      false,
    );
  } catch {
    return null;
  }
  const { relativePath, fullPath } = resolvedPath;

  markExpectedExternalChange(fullPath);
  try {
    if (preparedImport.contentToWrite === null) {
      await storage.copyFile(sourcePath, fullPath);
    } else {
      await storage.writeFile(fullPath, preparedImport.contentToWrite);
    }

    const copiedInfo = await storage.stat(fullPath).catch(() => null);
    if (copiedInfo?.isFile) {
      if (hasInvalidExternalMarkdownFileSize(copiedInfo)) {
        try { await storage.deleteFile(fullPath); } catch {}
        return null;
      }

      if (preparedImport.contentToWrite === null && typeof copiedInfo.size !== 'number') {
        const copiedContent = await storage.readFile(fullPath, MAX_EXTERNAL_MARKDOWN_FILE_SIZE).catch(() => null);
        if (copiedContent === null || !isExternalMarkdownContentWithinReadLimit(copiedContent)) {
          try { await storage.deleteFile(fullPath); } catch {}
          return null;
        }
      }

      return relativePath;
    }

    try { await storage.deleteFile(fullPath); } catch {}
    return null;
  } catch {
    try { await storage.deleteFile(fullPath); } catch {}
    return null;
  }
}

async function prepareImportableExternalMarkdownFile(
  sourcePath: string,
  fileInfo: { isFile?: boolean; size?: number } | null | undefined,
): Promise<PreparedExternalMarkdownFileImport | null> {
  if (!fileInfo?.isFile || !isSupportedMarkdownSelection(sourcePath)) {
    return null;
  }

  if (typeof fileInfo.size === 'number') {
    return isKnownExternalMarkdownFileSizeWithinLimit(fileInfo.size)
      ? { contentToWrite: null }
      : null;
  }

  const storage = getStorageAdapter();
  const sourceInfo = await storage.stat(sourcePath).catch(() => null);
  if (sourceInfo?.isFile === false || sourceInfo?.isDirectory === true) {
    return null;
  }
  if (typeof sourceInfo?.size === 'number') {
    return isKnownExternalMarkdownFileSizeWithinLimit(sourceInfo.size)
      ? { contentToWrite: null }
      : null;
  }

  try {
    const content = await storage.readFile(sourcePath, MAX_EXTERNAL_MARKDOWN_FILE_SIZE);
    return isExternalMarkdownContentWithinReadLimit(content)
      ? { contentToWrite: content }
      : null;
  } catch {
    return null;
  }
}

async function importExternalMarkdownDirectory(
  sourcePath: string,
  notesRootPath: string,
  targetFolderPath: string | undefined,
  importedNotePaths: string[],
  importedFolderPaths: string[],
  budget: ExternalMarkdownImportBudget,
  depth = 0,
) {
  if (
    budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES
  ) {
    return 0;
  }

  const storage = getStorageAdapter();
  let resolvedPath: Awaited<ReturnType<typeof resolveUniquePath>>;
  try {
    resolvedPath = await resolveUniquePath(
      notesRootPath,
      targetFolderPath,
      getBaseName(sourcePath),
      true,
    );
  } catch {
    return 0;
  }
  const { relativePath, fullPath } = resolvedPath;

  markExpectedExternalChange(fullPath, true);
  try {
    await storage.mkdir(fullPath, true);
  } catch {
    return 0;
  }

  let copiedMarkdownCount = 0;
  let entries: Awaited<ReturnType<typeof storage.listDir>>;
  try {
    entries = await storage.listDir(sourcePath, { includeHidden: true });
  } catch {
    await storage.deleteDir(fullPath, true);
    return 0;
  }

  for (const entry of prioritizeExternalMarkdownScanEntries(
    entries,
    getExternalMarkdownDirectoryEntryPriority,
    getExternalMarkdownPriorityScanLimit(budget.scannedEntries, MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES),
  )) {
    if (!spendExternalMarkdownScanBudget(budget)) {
      break;
    }
    if (!isSafeNotesRootPathSegment(entry.name)) {
      continue;
    }

    const sourceEntryPath = await joinPath(sourcePath, entry.name);

    if (entry.isDirectory) {
      if (shouldHideExternalMarkdownDirectory(entry.name)) {
        continue;
      }
      if (depth >= MAX_EXTERNAL_MARKDOWN_IMPORT_DEPTH) {
        continue;
      }
      if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
        break;
      }
      budget.visitedEntries += 1;
      copiedMarkdownCount += await importExternalMarkdownDirectory(
        sourceEntryPath,
        notesRootPath,
        relativePath,
        importedNotePaths,
        importedFolderPaths,
        budget,
        depth + 1,
      );
      continue;
    }

    if (!isSupportedMarkdownSelection(sourceEntryPath)) {
      continue;
    }
    if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
      break;
    }
    budget.visitedEntries += 1;

    const preparedImport = await prepareImportableExternalMarkdownFile(sourceEntryPath, entry);
    if (!preparedImport) {
      continue;
    }

    const importedPath = await importExternalMarkdownFile(sourceEntryPath, notesRootPath, relativePath, preparedImport);
    if (importedPath) {
      importedNotePaths.push(importedPath);
      copiedMarkdownCount += 1;
    }
  }

  if (copiedMarkdownCount === 0) {
    await storage.deleteDir(fullPath, true);
    return 0;
  }

  importedFolderPaths.push(relativePath);
  return copiedMarkdownCount;
}

export async function importExternalMarkdownEntries(
  notesRootPath: string,
  targetFolderPath: string,
  absolutePaths: string[],
): Promise<ExternalMarkdownImportResult> {
  const importedNotePaths: string[] = [];
  const importedFolderPaths: string[] = [];
  const budget: ExternalMarkdownImportBudget = {
    scannedEntries: 0,
    visitedEntries: 0,
  };

  for (const absolutePath of prioritizeExternalMarkdownScanEntries(
    absolutePaths,
    getExternalMarkdownAbsolutePathPriority,
    getExternalMarkdownPriorityScanLimit(budget.scannedEntries, MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES),
  )) {
    if (!spendExternalMarkdownScanBudget(budget)) {
      break;
    }
    if (!isAllowedExternalMarkdownPath(absolutePath)) {
      continue;
    }

    const info = await statExternalMarkdownPath(absolutePath).catch(() => null);
    if (!info) {
      continue;
    }
    const sourcePath = getAuthorizedExternalMarkdownPath(info, absolutePath);
    if (!isAllowedExternalMarkdownPath(sourcePath)) {
      continue;
    }

    if (info?.isDirectory) {
      if (shouldHideExternalMarkdownDirectory(getBaseName(sourcePath))) {
        continue;
      }
      if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
        break;
      }
      budget.visitedEntries += 1;
      await importExternalMarkdownDirectory(
        sourcePath,
        notesRootPath,
        targetFolderPath || undefined,
        importedNotePaths,
        importedFolderPaths,
        budget,
      );
      continue;
    }

    if (!info?.isFile || !isSupportedMarkdownSelection(sourcePath)) {
      continue;
    }
    if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
      break;
    }
    budget.visitedEntries += 1;

    const preparedImport = await prepareImportableExternalMarkdownFile(sourcePath, info);
    if (!preparedImport) {
      continue;
    }

    const importedPath = await importExternalMarkdownFile(
      sourcePath,
      notesRootPath,
      targetFolderPath || undefined,
      preparedImport,
    );
    if (importedPath) {
      importedNotePaths.push(importedPath);
    }
  }

  return {
    importedNotePaths,
    importedFolderPaths,
    didImport: importedNotePaths.length > 0 || importedFolderPaths.length > 0,
  };
}

export async function resolveExternalMarkdownEntriesForStarred(
  notesRootPath: string,
  absolutePaths: string[],
): Promise<ExternalMarkdownStarredTarget[]> {
  const targets: ExternalMarkdownStarredTarget[] = [];
  let scannedEntries = 0;

  for (const absolutePath of prioritizeExternalMarkdownScanEntries(
    absolutePaths,
    getExternalMarkdownAbsolutePathPriority,
    getExternalMarkdownPriorityScanLimit(scannedEntries, MAX_EXTERNAL_MARKDOWN_STARRED_SCAN_ENTRIES),
  )) {
    if (
      scannedEntries >= MAX_EXTERNAL_MARKDOWN_STARRED_SCAN_ENTRIES ||
      targets.length >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES
    ) {
      break;
    }
    scannedEntries += 1;

    if (!isAllowedExternalMarkdownPath(absolutePath)) {
      continue;
    }

    const info = await statExternalMarkdownPath(absolutePath).catch(() => null);
    if (!info) {
      continue;
    }
    const sourcePath = getAuthorizedExternalMarkdownPath(info, absolutePath);
    if (!isAllowedExternalMarkdownPath(sourcePath)) {
      continue;
    }

    const existingRelativePath = getExistingNotesRootRelativePath(notesRootPath, sourcePath);

    if (existingRelativePath) {
      if (info?.isDirectory) {
        targets.push({
          kind: 'folder',
          notesRootPath,
          relativePath: existingRelativePath,
        });
        continue;
      }

      if (info?.isFile && isSupportedMarkdownSelection(sourcePath)) {
        targets.push({
          kind: 'note',
          notesRootPath,
          relativePath: existingRelativePath,
        });
        continue;
      }
    }

    if (isPathInsideStarredNotesRoot(sourcePath, notesRootPath)) {
      continue;
    }

    if (!info || (!info.isDirectory && !(info.isFile && isSupportedMarkdownSelection(sourcePath)))) {
      continue;
    }

    const parentPath = getParentPath(sourcePath);
    const relativePath = getBaseName(sourcePath);
    if (!parentPath || !relativePath) {
      continue;
    }

    const target = createExternalStarredTarget(info, parentPath, relativePath);
    if (target) {
      targets.push(target);
    }
  }

  return targets;
}
