import { getElectronBridge } from '@/lib/electron/bridge';
import {
  getBaseName,
  getParentPath,
  getStorageAdapter,
  joinPath,
} from '@/lib/storage/adapter';
import type { StarredKind } from '@/stores/notes/types';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { resolveStarredRelativePathForVault } from '@/stores/notes/starred';
import { resolveUniquePath } from '@/stores/notes/utils/fs/pathOperations';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';

const MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES = 2000;
const MAX_EXTERNAL_MARKDOWN_IMPORT_DEPTH = 24;
const MAX_EXTERNAL_MARKDOWN_FILE_SIZE = 10 * 1024 * 1024;

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
  return relativePath;
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
  const entries = await storage.listDir(sourcePath);

  for (const entry of entries) {
    if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
      break;
    }
    budget.visitedEntries += 1;

    if (entry.name.startsWith('.')) {
      continue;
    }

    const sourceEntryPath = await joinPath(sourcePath, entry.name);

    if (entry.isDirectory) {
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

    if (!entry.isFile || !isSupportedMarkdownSelection(sourceEntryPath)) {
      continue;
    }
    if (typeof entry.size === 'number' && entry.size > MAX_EXTERNAL_MARKDOWN_FILE_SIZE) {
      continue;
    }

    const importedPath = await importExternalMarkdownFile(sourceEntryPath, vaultPath, relativePath);
    importedNotePaths.push(importedPath);
    copiedMarkdownCount += 1;
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
    if (budget.visitedEntries >= MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES) {
      break;
    }
    budget.visitedEntries += 1;

    const info = await statExternalMarkdownPath(absolutePath);
    if (info?.isDirectory) {
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
    if (typeof info.size === 'number' && info.size > MAX_EXTERNAL_MARKDOWN_FILE_SIZE) {
      continue;
    }

    const importedPath = await importExternalMarkdownFile(
      absolutePath,
      vaultPath,
      targetFolderPath || undefined,
    );
    importedNotePaths.push(importedPath);
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

  for (const absolutePath of absolutePaths) {
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

    if (!info?.isDirectory && !(info?.isFile && isSupportedMarkdownSelection(absolutePath))) {
      continue;
    }

    const parentPath = getParentPath(absolutePath);
    const relativePath = getBaseName(absolutePath);
    if (!parentPath || !relativePath) {
      continue;
    }

    targets.push({
      kind: info.isDirectory ? 'folder' : 'note',
      vaultPath: parentPath,
      relativePath,
    });
  }

  return targets;
}
