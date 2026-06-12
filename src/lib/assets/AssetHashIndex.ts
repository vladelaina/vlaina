import { getStorageAdapter, getParentPath } from '@/lib/storage/adapter';
import { ensureSystemDirectory, getVaultSystemStorePath } from '@/stores/notes/systemStoragePaths';

const ASSET_HASH_INDEX_FILE = 'asset-hash-index.json';
const ASSET_HASH_INDEX_VERSION = 1;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_INDEX_ENTRIES = 5000;
const MAX_INDEX_FILENAME_CHARS = 4096;
const MAX_INDEX_HASH_CHARS = 256;
const MAX_INDEX_MIME_TYPE_CHARS = 256;
const MAX_INDEX_UPDATED_AT_CHARS = 128;
const utf8Encoder = new TextEncoder();

export interface AssetHashIndexEntry {
  filename: string;
  hash: string;
  size: number;
  modifiedAt: number | null;
  mimeType: string;
  updatedAt: string;
}

interface AssetHashIndexFile {
  version: number;
  entries: Record<string, AssetHashIndexEntry>;
}

function createEmptyIndex(): AssetHashIndexFile {
  return {
    version: ASSET_HASH_INDEX_VERSION,
    entries: {},
  };
}

function normalizeEntry(value: unknown): AssetHashIndexEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Partial<AssetHashIndexEntry>;
  if (
    typeof entry.filename !== 'string' ||
    entry.filename.length === 0 ||
    entry.filename.length > MAX_INDEX_FILENAME_CHARS ||
    typeof entry.hash !== 'string' ||
    entry.hash.length === 0 ||
    entry.hash.length > MAX_INDEX_HASH_CHARS ||
    typeof entry.size !== 'number' ||
    !Number.isFinite(entry.size) ||
    entry.size < 0 ||
    typeof entry.mimeType !== 'string' ||
    entry.mimeType.length > MAX_INDEX_MIME_TYPE_CHARS ||
    typeof entry.updatedAt !== 'string' ||
    entry.updatedAt.length > MAX_INDEX_UPDATED_AT_CHARS
  ) {
    return null;
  }

  return {
    filename: entry.filename,
    hash: entry.hash,
    size: entry.size,
    modifiedAt: typeof entry.modifiedAt === 'number' ? entry.modifiedAt : null,
    mimeType: entry.mimeType,
    updatedAt: entry.updatedAt,
  };
}

function normalizeIndex(value: unknown): AssetHashIndexFile {
  if (!value || typeof value !== 'object') {
    return createEmptyIndex();
  }

  const source = value as Partial<AssetHashIndexFile>;
  const entries: Record<string, AssetHashIndexEntry> = {};
  let entryCount = 0;
  if (source.entries && typeof source.entries === 'object') {
    for (const [filename, rawEntry] of Object.entries(source.entries)) {
      if (entryCount >= MAX_INDEX_ENTRIES) {
        break;
      }
      if (filename.length === 0 || filename.length > MAX_INDEX_FILENAME_CHARS) {
        continue;
      }
      const entry = normalizeEntry(rawEntry);
      if (entry && entry.filename === filename) {
        entries[filename] = entry;
        entryCount += 1;
      }
    }
  }

  return {
    version: ASSET_HASH_INDEX_VERSION,
    entries,
  };
}

async function getIndexPath(vaultPath: string): Promise<string> {
  return getVaultSystemStorePath(vaultPath, ASSET_HASH_INDEX_FILE);
}

export async function loadAssetHashIndex(vaultPath: string): Promise<AssetHashIndexFile> {
  try {
    const storage = getStorageAdapter();
    const indexPath = await getIndexPath(vaultPath);
    const info = await storage.stat(indexPath).catch(() => null);
    if (
      info?.isDirectory === true ||
      info?.isFile === false ||
      (
        typeof info?.size === 'number' &&
        info.size > MAX_INDEX_BYTES
      )
    ) {
      return createEmptyIndex();
    }

    const content = await storage.readFile(indexPath, MAX_INDEX_BYTES);
    if (utf8Encoder.encode(content).length > MAX_INDEX_BYTES) {
      return createEmptyIndex();
    }

    return normalizeIndex(JSON.parse(content));
  } catch {
    return createEmptyIndex();
  }
}

export async function saveAssetHashIndex(vaultPath: string, index: AssetHashIndexFile): Promise<void> {
  const storage = getStorageAdapter();
  const indexPath = await getIndexPath(vaultPath);
  const parentPath = getParentPath(indexPath);
  if (parentPath) {
    await ensureSystemDirectory(parentPath);
  }

  await storage.writeFile(indexPath, JSON.stringify({
    version: ASSET_HASH_INDEX_VERSION,
    entries: index.entries,
  }, null, 2));
}

export function getAssetHashIndexEntry(
  index: AssetHashIndexFile,
  filename: string,
): AssetHashIndexEntry | undefined {
  return index.entries[filename];
}

export function setAssetHashIndexEntry(
  index: AssetHashIndexFile,
  entry: AssetHashIndexEntry,
): void {
  index.entries[entry.filename] = entry;
}
