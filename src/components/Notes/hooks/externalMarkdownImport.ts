import { getElectronBridge } from '@/lib/electron/bridge';
import { getBaseName, getParentPath, getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import type { StarredKind } from '@/stores/notes/types';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import {
  isPathInsideStarredVault,
  isValidStarredVaultPath,
  normalizeStarredRelativePath,
  resolveStarredRelativePathForVault,
} from '@/stores/notes/starred';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { resolveUniquePath } from '@/stores/notes/utils/fs/pathOperations';
import { isSafeVaultPathSegment } from '@/stores/notes/utils/fs/vaultPathContainment';
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
  vaultPath: string;
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
  const buckets = new Map<number, T[]>();
  for (const entry of entries) {
    const priority = getPriority(entry);
    const bucket = buckets.get(priority) ?? [];
    if (bucket.length < maxEntries) {
      bucket.push(entry);
      buckets.set(priority, bucket);
    }
  }

  const prioritized: T[] = [];
  for (const priority of Array.from(buckets.keys()).sort((left, right) => left - right)) {
    for (const entry of buckets.get(priority) ?? []) {
      if (prioritized.length >= maxEntries) {
        return prioritized;
      }
      prioritized.push(entry);
    }
  }
  return prioritized;
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
  if (!isSafeVaultPathSegment(entry.name)) {
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
  return pathWithoutDrive
    .split('/')
    .filter(Boolean)
    .some((segment) => !isSafeVaultPathSegment(segment));
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

function getExistingVaultRelativePath(vaultPath: string, absolutePath: string) {
  return resolveStarredRelativePathForVault(absolutePath, vaultPath);
}

function createExternalStarredTarget(
  info: { isDirectory?: boolean; isFile?: boolean },
  vaultPath: string,
  relativePath: string,
): ExternalMarkdownStarredTarget | null {
  if (!isValidStarredVaultPath(vaultPath)) {
    return null;
  }

  const normalizedRelativePath = normalizeStarredRelativePath(relativePath);
  if (!normalizedRelativePath) {
    return null;
  }

  return {
    kind: info.isDirectory ? 'folder' : 'note',
    vaultPath,
    relativePath: normalizedRelativePath,
  };
}

async function importExternalMarkdownFile(
  sourcePath: string,
  vaultPath: string,
  targetFolderPath: string | undefined,
  preparedImport: PreparedExternalMarkdownFileImport,
) {
  const storage = getStorageAdapter();
  let resolvedPath: Awaited<ReturnType<typeof resolveUniquePath>>;
  try {
    resolvedPath = await resolveUniquePath(
      vaultPath,
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
  vaultPath: string,
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
      vaultPath,
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
    MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES,
  )) {
    if (!spendExternalMarkdownScanBudget(budget)) {
      break;
    }
    if (!isSafeVaultPathSegment(entry.name)) {
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
        vaultPath,
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

    const importedPath = await importExternalMarkdownFile(sourceEntryPath, vaultPath, relativePath, preparedImport);
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
  vaultPath: string,
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
    MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES,
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
        vaultPath,
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
      vaultPath,
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
  vaultPath: string,
  absolutePaths: string[],
): Promise<ExternalMarkdownStarredTarget[]> {
  const targets: ExternalMarkdownStarredTarget[] = [];
  let scannedEntries = 0;

  for (const absolutePath of prioritizeExternalMarkdownScanEntries(
    absolutePaths,
    getExternalMarkdownAbsolutePathPriority,
    MAX_EXTERNAL_MARKDOWN_PRIORITY_SCAN_ENTRIES,
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

    const existingRelativePath = getExistingVaultRelativePath(vaultPath, sourcePath);

    if (existingRelativePath) {
      if (info?.isDirectory) {
        targets.push({
          kind: 'folder',
          vaultPath,
          relativePath: existingRelativePath,
        });
        continue;
      }

      if (info?.isFile && isSupportedMarkdownSelection(sourcePath)) {
        targets.push({
          kind: 'note',
          vaultPath,
          relativePath: existingRelativePath,
        });
        continue;
      }
    }

    if (isPathInsideStarredVault(sourcePath, vaultPath)) {
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
