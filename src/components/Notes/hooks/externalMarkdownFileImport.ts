import { getBaseName, getStorageAdapter } from '@/lib/storage/adapter';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { resolveUniquePath } from '@/stores/notes/utils/fs/pathOperations';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';
import {
  hasInvalidExternalMarkdownFileSize,
  isExternalMarkdownContentWithinReadLimit,
  isKnownExternalMarkdownFileSizeWithinLimit,
  MAX_EXTERNAL_MARKDOWN_FILE_SIZE,
  type PreparedExternalMarkdownFileImport,
} from './externalMarkdownImportTypes';

export async function importExternalMarkdownFile(
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

export async function prepareImportableExternalMarkdownFile(
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
