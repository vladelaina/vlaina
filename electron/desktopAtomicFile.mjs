import { open, rename, rm } from 'node:fs/promises';
import path from 'node:path';

async function syncDirectoryBestEffort(dirPath) {
  let handle = null;
  try {
    handle = await open(dirPath, 'r');
    await handle.sync();
  } catch {
    // Directory fsync is not supported on every platform/filesystem.
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function writeFileAtomically(filePath, content, options = {}) {
  const openFile = options.openFile ?? open;
  const dirPath = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tempPath = path.join(
    dirPath,
    `.${baseName}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  let handle = null;
  try {
    handle = await openFile(tempPath, 'w');
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tempPath, filePath);
    await syncDirectoryBestEffort(dirPath);
  } catch (error) {
    await handle?.close().catch(() => {});
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}
