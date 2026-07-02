import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { ensureSystemDirectory, getNotesRootSystemStorePath } from './notes/systemStoragePaths';

const CONFIG_FILE_NAME = 'config.json';
const MAX_NOTES_ROOT_CONFIG_BYTES = 64 * 1024;
const utf8Encoder = new TextEncoder();

function createNotesRootConfig(notesRootPath: string) {
  return {
    version: 1,
    created: Date.now(),
    notesRootPath,
  };
}

export function normalizeNotesRootPath(path: string): string {
  const withForwardSlashes = path.replace(/\\/g, '/');

  if (withForwardSlashes === '/' || /^[a-zA-Z]:\/$/.test(withForwardSlashes)) {
    return withForwardSlashes;
  }

  const normalized = withForwardSlashes.replace(/\/+$/, '');
  return normalized || withForwardSlashes;
}

export async function ensureNotesRootConfig(notesRootPath: string): Promise<void> {
  const storage = getStorageAdapter();
  const normalizedNotesRootPath = normalizeNotesRootPath(notesRootPath);
  const storePath = await getNotesRootSystemStorePath(normalizedNotesRootPath);
  await ensureSystemDirectory(storePath);

  const configFilePath = await joinPath(storePath, CONFIG_FILE_NAME);
  if (!(await storage.exists(configFilePath))) {
    await storage.writeFile(
      configFilePath,
      JSON.stringify(createNotesRootConfig(normalizedNotesRootPath), null, 2)
    );
    return;
  }

  try {
    const fileInfo = await storage.stat(configFilePath).catch(() => null);
    if (
      fileInfo?.isDirectory === true ||
      fileInfo?.isFile === false ||
      (typeof fileInfo?.size === 'number' && (
        !Number.isFinite(fileInfo.size) ||
        fileInfo.size < 0 ||
        fileInfo.size > MAX_NOTES_ROOT_CONFIG_BYTES
      ))
    ) {
      await storage.writeFile(
        configFilePath,
        JSON.stringify(createNotesRootConfig(normalizedNotesRootPath), null, 2)
      );
      return;
    }

    const content = await storage.readFile(configFilePath, MAX_NOTES_ROOT_CONFIG_BYTES);
    if (utf8Encoder.encode(content).length > MAX_NOTES_ROOT_CONFIG_BYTES) {
      await storage.writeFile(
        configFilePath,
        JSON.stringify(createNotesRootConfig(normalizedNotesRootPath), null, 2)
      );
      return;
    }

    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      await storage.writeFile(
        configFilePath,
        JSON.stringify(createNotesRootConfig(normalizedNotesRootPath), null, 2)
      );
      return;
    }

    if (parsed.notesRootPath !== normalizedNotesRootPath) {
      await storage.writeFile(
        configFilePath,
        JSON.stringify({ ...parsed, notesRootPath: normalizedNotesRootPath }, null, 2)
      );
    }
  } catch {
    await storage.writeFile(
      configFilePath,
      JSON.stringify(createNotesRootConfig(normalizedNotesRootPath), null, 2)
    );
  }
}
