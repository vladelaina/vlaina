import { getElectronBridge } from '@/lib/electron/bridge';
import { getBaseName, getParentPath, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { StarredKind } from '@/stores/notes/types';
import { APP_CONFIG_FOLDER } from '@/stores/notes/constants';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import {
  isPathInsideStarredVault,
  normalizeStarredRelativePath,
  resolveStarredRelativePathForVault,
} from '@/stores/notes/starred';
import { resolveUniquePath } from '@/stores/notes/utils/fs/pathOperations';
import { isSafeVaultPathSegment } from '@/stores/notes/utils/fs/vaultPathContainment';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';

const MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES = 2000;
const MAX_EXTERNAL_MARKDOWN_IMPORT_DEPTH = 24;
const MAX_EXTERNAL_MARKDOWN_FILE_SIZE = 10 * 1024 * 1024;
const SKIPPED_EXTERNAL_MARKDOWN_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);
const INTERNAL_EXTERNAL_MARKDOWN_DIRECTORY_NAMES = new Set([APP_CONFIG_FOLDER, '.git']);

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
  visitedEntries: number;
}

function shouldSkipExternalMarkdownDirectory(name: string) {
  return (
    INTERNAL_EXTERNAL_MARKDOWN_DIRECTORY_NAMES.has(name) ||
    SKIPPED_EXTERNAL_MARKDOWN_DIRECTORY_NAMES.has(name)
  );
}

function isInsideInternalExternalMarkdownPath(path: string) {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => INTERNAL_EXTERNAL_MARKDOWN_DIRECTORY_NAMES.has(segment));
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
  const { relativePath, fullPath } = await resolveUniquePath(
    vaultPath,
    targetFolderPath,
    getBaseName(sourcePath),
    false,
  );

  markExpectedExternalChange(fullPath);
  await storage.copyFile(sourcePath, fullPath);

  const copiedInfo = await storage.stat(fullPath).catch(() => null);
  if (
    !copiedInfo?.isFile ||
    typeof copiedInfo.size !== 'number' ||
    copiedInfo.size > MAX_EXTERNAL_MARKDOWN_FILE_SIZE
  ) {
    try { await storage.deleteFile(fullPath); } catch {}
    return null;
  }

  return relativePath;
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
    depth >= MAX_EXTERNAL_MARKDOWN_IMPORT_DEPTH ||
    budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES
  ) {
    return 0;
  }

  const storage = getStorageAdapter();
  const { relativePath, fullPath } = await resolveUniquePath(
    vaultPath,
    targetFolderPath,
    getBaseName(sourcePath),
    true,
  );

  markExpectedExternalChange(fullPath, true);
  await storage.mkdir(fullPath, true);

  let copiedMarkdownCount = 0;
  let entries: Awaited<ReturnType<typeof storage.listDir>>;
  try {
    entries = await storage.listDir(sourcePath, { includeHidden: true });
  } catch {
    await storage.deleteDir(fullPath, true);
    return 0;
  }

  for (const entry of entries) {
    if (!isSafeVaultPathSegment(entry.name)) {
      continue;
    }

    const sourceEntryPath = await joinPath(sourcePath, entry.name);

    if (entry.isDirectory) {
      if (shouldSkipExternalMarkdownDirectory(entry.name)) {
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
  const budget: ExternalMarkdownImportBudget = { visitedEntries: 0 };

  for (const absolutePath of absolutePaths) {
    if (isInsideInternalExternalMarkdownPath(absolutePath)) {
      continue;
    }

    const info = await statExternalMarkdownPath(absolutePath);
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
  let visitedEntries = 0;

  for (const absolutePath of absolutePaths) {
    if (visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
      break;
    }
    visitedEntries += 1;

    if (isInsideInternalExternalMarkdownPath(absolutePath)) {
      continue;
    }

    const info = await statExternalMarkdownPath(absolutePath);
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
