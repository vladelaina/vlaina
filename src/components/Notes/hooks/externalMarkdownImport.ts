import { getElectronBridge } from '@/lib/electron/bridge';
import { getBaseName, getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { resolveUniquePath } from '@/stores/notes/utils/fs/pathOperations';
import { isSupportedMarkdownSelection } from '../features/OpenTarget/openTargetSelection';

interface ExternalMarkdownImportResult {
  importedNotePaths: string[];
  importedFolderPaths: string[];
}

async function statExternalMarkdownPath(absolutePath: string) {
  const dragDrop = getElectronBridge()?.dragDrop;
  if (dragDrop) {
    return dragDrop.authorizePath(absolutePath);
  }

  return getStorageAdapter().stat(absolutePath);
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
) {
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
      );
      continue;
    }

    if (!entry.isFile || !isSupportedMarkdownSelection(sourceEntryPath)) {
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

  for (const absolutePath of absolutePaths) {
    const info = await statExternalMarkdownPath(absolutePath);
    if (info?.isDirectory) {
      await importExternalMarkdownDirectory(
        absolutePath,
        vaultPath,
        targetFolderPath || undefined,
        importedNotePaths,
        importedFolderPaths,
      );
      continue;
    }

    if (!info?.isFile || !isSupportedMarkdownSelection(absolutePath)) {
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
  };
}
