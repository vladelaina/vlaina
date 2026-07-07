import { getBaseName, getParentPath } from '@/lib/storage/adapter';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import {
  createExternalStarredTarget,
  getAuthorizedExternalMarkdownPath,
  getExistingNotesRootRelativePath,
  getExternalMarkdownAbsolutePathPriority,
  getExternalMarkdownPriorityScanLimit,
  isAllowedExternalMarkdownPath,
  isPathInsideStarredNotesRoot,
  prioritizeExternalMarkdownScanEntries,
  statExternalMarkdownPath,
} from './externalMarkdownImportScan';
import {
  MAX_EXTERNAL_MARKDOWN_IMPORT_ENTRIES,
  MAX_EXTERNAL_MARKDOWN_STARRED_SCAN_ENTRIES,
  type ExternalMarkdownStarredTarget,
} from './externalMarkdownImportTypes';

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
