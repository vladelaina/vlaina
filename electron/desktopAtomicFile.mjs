import { createHash } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

const WRITE_LOCK_RETRY_MS = 10;
const WRITE_LOCK_TIMEOUT_MS = 2000;
const WRITE_LOCK_STALE_MS = 30000;

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === 'object' && error.code === 'EPERM');
  }
}

async function acquireWriteLock(lockPath) {
  const startedAt = Date.now();
  while (true) {
    let handle = null;
    try {
      handle = await open(lockPath, 'wx');
      const token = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      await handle.writeFile(token);
      return { handle, token };
    } catch (error) {
      await handle?.close().catch(() => {});
      if (handle) {
        await rm(lockPath, { force: true }).catch(() => {});
      }
      if (!error || typeof error !== 'object' || error.code !== 'EEXIST') {
        throw error;
      }
      const lockInfo = await stat(lockPath).catch(() => null);
      if (lockInfo && Date.now() - lockInfo.mtimeMs > WRITE_LOCK_STALE_MS) {
        const lockToken = await readFile(lockPath, 'utf8').catch(() => '');
        const ownerPid = Number.parseInt(lockToken.split(':', 1)[0] ?? '', 10);
        if (!isProcessAlive(ownerPid)) {
          await rm(lockPath, { force: true }).catch(() => {});
          continue;
        }
      }
      if (Date.now() - startedAt >= WRITE_LOCK_TIMEOUT_MS) {
        throw new Error('Timed out waiting for another vlaina window to finish saving this note.');
      }
      await new Promise((resolve) => setTimeout(resolve, WRITE_LOCK_RETRY_MS));
    }
  }
}

async function releaseWriteLock(lockPath, lock) {
  await lock.handle.close().catch(() => {});
  const currentToken = await readFile(lockPath, 'utf8').catch(() => null);
  if (currentToken === lock.token) {
    await rm(lockPath, { force: true }).catch(() => {});
  }
}

export async function writeFileAtomicallyIfUnchanged(filePath, expectedContent, content) {
  const writeTargetPath = expectedContent === null
    ? filePath
    : await realpath(filePath).catch((error) => {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        return filePath;
      }
      throw error;
    });
  const lockDir = path.join(tmpdir(), 'vlaina-note-write-locks');
  await mkdir(lockDir, { recursive: true });
  const lockKey = process.platform === 'win32'
    ? path.resolve(writeTargetPath).toLowerCase()
    : path.resolve(writeTargetPath);
  const lockPath = path.join(
    lockDir,
    `${createHash('sha256').update(lockKey).digest('hex')}.lock`,
  );
  const lock = await acquireWriteLock(lockPath);
  try {
    const currentContent = await readFile(writeTargetPath, 'utf8').catch((error) => {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    });
    if (currentContent !== expectedContent) {
      return false;
    }
    await writeFileAtomically(writeTargetPath, content);
    return true;
  } finally {
    await releaseWriteLock(lockPath, lock);
  }
}
