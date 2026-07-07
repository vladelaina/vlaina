import { getBaseName } from '@/lib/storage/adapter';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import { importExternalMarkdownDirectory } from './externalMarkdownDirectoryImport';
import { importExternalMarkdownFile, prepareImportableExternalMarkdownFile } from './externalMarkdownFileImport';
import {
  getAuthorizedExternalMarkdownPath,
  getExternalMarkdownAbsolutePathPriority,
  getExternalMarkdownPriorityScanLimit,
  isAllowedExternalMarkdownPath,
  prioritizeExternalMarkdownScanEntries,
  statExternalMarkdownPath,
} from './externalMarkdownImportScan';
import {
  MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES,
  MAX_EXTERNAL_MARKDOWN_SCAN_ENTRIES,
  shouldHideExternalMarkdownDirectory,
  spendExternalMarkdownScanBudget,
  type ExternalMarkdownImportBudget,
  type ExternalMarkdownImportResult,
  type ExternalMarkdownStarredTarget,
} from './externalMarkdownImportTypes';
import { resolveExternalMarkdownEntriesForStarred } from './externalMarkdownStarredImport';

export type { ExternalMarkdownStarredTarget };
export { resolveExternalMarkdownEntriesForStarred };

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
