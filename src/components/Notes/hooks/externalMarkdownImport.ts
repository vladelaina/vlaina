import { getElectronBridge } from '@/lib/electron/bridge';
import { getBaseName, getParentPath, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
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
const EXPLICIT_URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const SKIPPED_EXTERNAL_MARKDOWN_DIRECTORY_NAMES = new Set([
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

function shouldSkipExternalMarkdownDirectory(name: string) {
  return (
    hasInternalNotePathSegment(name) ||
    SKIPPED_EXTERNAL_MARKDOWN_DIRECTORY_NAMES.has(name.toLowerCase())
  );
}

function prioritizeExternalMarkdownScanEntries<T>(
  entries: readonly T[],
  getPriority: (entry: T) => number,
  maxEntries = entries.length,
): T[] {
  const scanEntries = entries.length > maxEntries ? entries.slice(0, maxEntries) : entries;
  return scanEntries
    .map((entry, index) => ({ entry, index, priority: getPriority(entry) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ entry }) => entry);
}

function getExternalMarkdownAbsolutePathPriority(path: string) {
  const baseName = getBaseName(path).trim();
  if (!baseName) {
    return 2;
  }
  if (isSupportedMarkdownSelection(path) || baseName.lastIndexOf('.') <= 0) {
    return 0;
  }
  return 1;
}

function getExternalMarkdownDirectoryEntryPriority(entry: {
  name: string;
  isDirectory?: boolean;
  isFile?: boolean;
}) {
  if (!isSafeVaultPathSegment(entry.name)) {
    return 2;
  }
  if (entry.isDirectory || (entry.isFile && isSupportedMarkdownSelection(entry.name))) {
    return 0;
  }
  return 1;
}

function isInsideInternalExternalMarkdownPath(path: string) {
  return hasInternalNotePathSegment(path);
}

function isBlankExternalMarkdownPath(path: string) {
  return path.trim().length === 0;
}

function hasExplicitExternalMarkdownNonPathScheme(path: string) {
  const trimmed = path.trim();
  return EXPLICIT_URL_SCHEME_PATTERN.test(trimmed) && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed);
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
    await storage.copyFile(sourcePath, fullPath);

    const copiedInfo = await storage.stat(fullPath).catch(() => null);
    if (
      copiedInfo?.isFile &&
      typeof copiedInfo.size === 'number' &&
      copiedInfo.size <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE
    ) {
      return relativePath;
    }

    try { await storage.deleteFile(fullPath); } catch {}
    return null;
  } catch {
    try { await storage.deleteFile(fullPath); } catch {}
    return null;
  }
}

async function isImportableExternalMarkdownFile(
  sourcePath: string,
  fileInfo: { isFile?: boolean; size?: number } | null | undefined,
) {
  if (!fileInfo?.isFile || !isSupportedMarkdownSelection(sourcePath)) {
    return false;
  }

  if (typeof fileInfo.size === 'number') {
    return fileInfo.size <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE;
  }

  const sourceInfo = await getStorageAdapter().stat(sourcePath).catch(() => null);
  return Boolean(
    sourceInfo?.isFile &&
    typeof sourceInfo.size === 'number' &&
    sourceInfo.size <= MAX_EXTERNAL_MARKDOWN_FILE_SIZE
  );
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
      if (shouldSkipExternalMarkdownDirectory(entry.name)) {
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

    if (!await isImportableExternalMarkdownFile(sourceEntryPath, entry)) {
      continue;
    }

    const importedPath = await importExternalMarkdownFile(sourceEntryPath, vaultPath, relativePath);
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
    if (
      isBlankExternalMarkdownPath(absolutePath) ||
      hasExplicitExternalMarkdownNonPathScheme(absolutePath) ||
      isInsideInternalExternalMarkdownPath(absolutePath) ||
      hasUnsafeExternalMarkdownPathSegment(absolutePath)
    ) {
      continue;
    }

    const info = await statExternalMarkdownPath(absolutePath).catch(() => null);
    if (!info) {
      continue;
    }
    if (info?.isDirectory) {
      if (shouldSkipExternalMarkdownDirectory(getBaseName(absolutePath))) {
        continue;
      }
      if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
        break;
      }
      budget.visitedEntries += 1;
      await importExternalMarkdownDirectory(
        absolutePath,
        vaultPath,
        targetFolderPath || undefined,
        importedNotePaths,
        importedFolderPaths,
        budget,
      );
      continue;
    }

    if (!info?.isFile || !isSupportedMarkdownSelection(absolutePath)) {
      continue;
    }
    if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
      break;
    }
    budget.visitedEntries += 1;

    if (!await isImportableExternalMarkdownFile(absolutePath, info)) {
      continue;
    }

    const importedPath = await importExternalMarkdownFile(
      absolutePath,
      vaultPath,
      targetFolderPath || undefined,
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

    if (
      isBlankExternalMarkdownPath(absolutePath) ||
      hasExplicitExternalMarkdownNonPathScheme(absolutePath) ||
      isInsideInternalExternalMarkdownPath(absolutePath) ||
      hasUnsafeExternalMarkdownPathSegment(absolutePath)
    ) {
      continue;
    }

    const info = await statExternalMarkdownPath(absolutePath).catch(() => null);
    if (!info) {
      continue;
    }
    const existingRelativePath = getExistingVaultRelativePath(vaultPath, absolutePath);

    if (existingRelativePath) {
      if (info?.isDirectory) {
        targets.push({
          kind: 'folder',
          vaultPath,
          relativePath: existingRelativePath,
        });
        continue;
      }

      if (info?.isFile && isSupportedMarkdownSelection(absolutePath)) {
        targets.push({
          kind: 'note',
          vaultPath,
          relativePath: existingRelativePath,
        });
        continue;
      }
    }

    if (isPathInsideStarredVault(absolutePath, vaultPath)) {
      continue;
    }

    if (!info || (!info.isDirectory && !(info.isFile && isSupportedMarkdownSelection(absolutePath)))) {
      continue;
    }

    const parentPath = getParentPath(absolutePath);
    const relativePath = getBaseName(absolutePath);
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
