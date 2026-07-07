import { getBaseName, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { resolveUniquePath } from '@/stores/notes/utils/fs/pathOperations';
import { isSafeNotesRootPathSegment } from '@/stores/notes/utils/fs/notesRootPathContainment';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import { importExternalMarkdownFile, prepareImportableExternalMarkdownFile } from './externalMarkdownFileImport';
import {
  MAX_EXTERNAL_MARKDOWN_IMPORT_DEPTH,
  MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES,
  MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES,
  shouldHideExternalMarkdownDirectory,
  spendExternalMarkdownScanBudget,
  type ExternalMarkdownImportBudget,
} from './externalMarkdownImportTypes';
import {
  getExternalMarkdownDirectoryEntryPriority,
  getExternalMarkdownPriorityScanLimit,
  prioritizeExternalMarkdownScanEntries,
} from './externalMarkdownImportScan';

export async function importExternalMarkdownDirectory(
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
