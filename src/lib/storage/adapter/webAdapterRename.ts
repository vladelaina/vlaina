import type { PrefixScanResult, StoredDir, StoredFile } from './webAdapterTypes';

export async function renameWebAdapterDirectory({
  normalizedOld,
  normalizedNew,
  oldPath,
  readStoredFilesByPrefix,
  readStoredDirsByPrefix,
  assertCompletePrefixScan,
  writeStoredFile,
  deleteFile,
  createDirEntry,
  deleteDirEntry,
}: {
  normalizedOld: string;
  normalizedNew: string;
  oldPath: string;
  readStoredFilesByPrefix: (prefix: string) => Promise<PrefixScanResult<StoredFile>>;
  readStoredDirsByPrefix: (prefix: string) => Promise<PrefixScanResult<StoredDir>>;
  assertCompletePrefixScan: (
    fileScan: PrefixScanResult<StoredFile>,
    dirScan: PrefixScanResult<StoredDir>,
    operation: 'delete' | 'move',
  ) => void;
  writeStoredFile: (path: string, file: StoredFile) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  createDirEntry: (path: string) => Promise<void>;
  deleteDirEntry: (path: string) => Promise<void>;
}): Promise<void> {
  if (normalizedNew.startsWith(`${normalizedOld}/`)) {
    throw new Error(`Cannot move a directory into itself: ${oldPath}`);
  }

  const prefix = normalizedOld + '/';
  const fileScan = await readStoredFilesByPrefix(prefix);
  const dirScan = await readStoredDirsByPrefix(normalizedOld);
  assertCompletePrefixScan(fileScan, dirScan, 'move');
  for (const file of fileScan.entries) {
    if (!file.path.startsWith(prefix)) continue;
    await writeStoredFile(normalizedNew + file.path.slice(normalizedOld.length), file);
    await deleteFile(file.path);
  }
  for (const dir of dirScan.entries) {
    if (dir.path !== normalizedOld && !dir.path.startsWith(prefix)) continue;
    const newDirPath = dir.path === normalizedOld ? normalizedNew : normalizedNew + dir.path.slice(normalizedOld.length);
    await createDirEntry(newDirPath);
    await deleteDirEntry(dir.path);
  }
}
