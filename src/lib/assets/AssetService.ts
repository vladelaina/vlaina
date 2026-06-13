import { AssetEntry, UploadResult } from './types';
import { getStorageAdapter, getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { computeBufferHash, computeFileHash } from './core/hashing';
import { getMimeType, generateFilename, processFilename } from './core/naming';
import { writeAssetAtomic } from './io/writer';
import { normalizeContainedAssetPath } from './core/pathContainment';
import { hasInternalNoteAssetPathSegment } from './core/internalAssetPaths';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import { hasUnsafeVaultPathSegment, isSafeVaultPathSegment } from '@/stores/notes/utils/fs/vaultPathContainment';
import {
  getAssetHashIndexEntry,
  loadAssetHashIndex,
  saveAssetHashIndex,
  setAssetHashIndexEntry,
} from './AssetHashIndex';

export interface AssetContext {
  vaultPath: string;
  currentNotePath?: string;
}

export interface AssetConfig {
  storageMode: 'vault' | 'vaultSubfolder' | 'currentFolder' | 'subfolder';
  subfolderName?: string;
  imageVaultSubfolderName?: string;
  filenameFormat: 'original' | 'timestamp' | 'sequence';
}

const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_ASSET_LIST_DIRECTORY_ENTRIES = 5000;
export const MAX_ASSET_METADATA_STAT_CONCURRENCY = 8;
const ASSET_DIRECTORY_ENTRY_PRIORITY_BUCKETS = 3;
const UNSAFE_ASSET_ENTRY_NAME_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const IMAGE_UPLOAD_EXTENSIONS_BY_MIME: Record<string, readonly string[]> = {
  'image/avif': ['avif'],
  'image/bmp': ['bmp'],
  'image/gif': ['gif'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/svg+xml': ['svg'],
  'image/vnd.microsoft.icon': ['ico'],
  'image/webp': ['webp'],
  'image/x-icon': ['ico'],
};

function getKnownAssetSize(size: number | null | undefined): number | undefined {
  return typeof size === 'number' && Number.isFinite(size) && size >= 0
    ? size
    : undefined;
}

function createAssetSizeError(size: number | null | undefined): string {
  const knownSize = getKnownAssetSize(size);
  return knownSize === undefined
    ? 'File size is invalid. Limit is 50MB.'
    : `File is too large (${(knownSize / 1024 / 1024).toFixed(1)}MB). Limit is 50MB.`;
}

function getKnownAssetModifiedAt(modifiedAt: number | null | undefined): number | undefined {
  return typeof modifiedAt === 'number' && Number.isFinite(modifiedAt)
    ? modifiedAt
    : undefined;
}

function isIndexedAssetFresh(
  entry: { size?: number; modifiedAt?: number | null },
  indexed: { size: number; modifiedAt: number | null },
) {
  const size = getKnownAssetSize(entry.size);
  const modifiedAt = getKnownAssetModifiedAt(entry.modifiedAt);
  return size !== undefined && size === indexed.size && modifiedAt !== undefined && modifiedAt === indexed.modifiedAt;
}

async function saveAssetHashIndexBestEffort(
  vaultPath: string,
  index: Parameters<typeof saveAssetHashIndex>[1],
) {
  try {
    await saveAssetHashIndex(vaultPath, index);
  } catch {
  }
}

function getOriginalStoredFilename(fileName: string): string {
  return processFilename(fileName, new Set());
}

function getImageExtensionFromMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    case 'image/bmp':
      return '.bmp';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return '.ico';
    case 'image/avif':
      return '.avif';
    default:
      return '.png';
  }
}

function normalizeUploadImageMimeType(value: string): string | null {
  const mimeType = value.split(';')[0]?.trim().toLowerCase() ?? '';
  return Object.prototype.hasOwnProperty.call(IMAGE_UPLOAD_EXTENSIONS_BY_MIME, mimeType) ? mimeType : null;
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function hasUploadMimeExtension(fileName: string, mimeType: string): boolean {
  return IMAGE_UPLOAD_EXTENSIONS_BY_MIME[mimeType]?.includes(getFileExtension(fileName)) === true;
}

function getUploadFilename(file: File, mimeType: string): string {
  const rawName = file.name.trim();
  const extension = getImageExtensionFromMimeType(mimeType);
  if (rawName) {
    if (hasUploadMimeExtension(rawName, mimeType)) {
      return rawName;
    }

    const dotIndex = rawName.lastIndexOf('.');
    return dotIndex > 0 ? `${rawName.slice(0, dotIndex)}${extension}` : `${rawName}${extension}`;
  }

  return `image${extension}`;
}

function prepareUploadBytes(bytes: Uint8Array, mimeType: string): Uint8Array {
  return mimeType === 'image/svg+xml' ? sanitizeSvgBytes(bytes) : bytes;
}

function isSameAssetName(entryName: string, fileName: string): boolean {
  return entryName.toLowerCase() === getOriginalStoredFilename(fileName).toLowerCase();
}

interface NormalizedAssetDirectoryEntry {
  name: string;
  path: string;
  size?: number;
  modifiedAt?: number;
}

function isSafeAssetEntryName(name: string): boolean {
  return Boolean(name)
    && name !== '.'
    && name !== '..'
    && !/[\\/]/.test(name)
    && !UNSAFE_ASSET_ENTRY_NAME_CHARS.test(name);
}

function isSameNormalizedPath(leftPath: string, rightPath: string): boolean {
  return (
    normalizeContainedAssetPath(leftPath, rightPath) !== null &&
    normalizeContainedAssetPath(rightPath, leftPath) !== null
  );
}

async function normalizeAssetDirectoryEntry(
  targetDir: string,
  entry: { name: string; path: string; isFile: boolean; size?: number; modifiedAt?: number },
): Promise<NormalizedAssetDirectoryEntry | null> {
  if (!entry.isFile || !isSafeAssetEntryName(entry.name)) {
    return null;
  }

  const containedPath = normalizeContainedAssetPath(entry.path, targetDir);
  const expectedPath = normalizeContainedAssetPath(await joinPath(targetDir, entry.name), targetDir);
  if (!containedPath || !expectedPath || !isSameNormalizedPath(containedPath, expectedPath)) {
    return null;
  }

  return {
    name: entry.name,
    path: containedPath,
    size: getKnownAssetSize(entry.size),
    modifiedAt: getKnownAssetModifiedAt(entry.modifiedAt),
  };
}

async function hydrateAssetEntryMetadata(
  storage: ReturnType<typeof getStorageAdapter>,
  entries: NormalizedAssetDirectoryEntry[],
  options: { forceStat?: boolean } = {},
) {
  return mapWithConcurrencyLimit(entries, MAX_ASSET_METADATA_STAT_CONCURRENCY, async (entry) => {
    const entrySize = getKnownAssetSize(entry.size);
    const entryModifiedAt = getKnownAssetModifiedAt(entry.modifiedAt);
    if (!options.forceStat && entrySize !== undefined && entryModifiedAt !== undefined) {
      return entry;
    }

    const info = await storage.stat(entry.path).catch(() => null);
    const infoSize = getKnownAssetSize(info?.size);
    const infoModifiedAt = getKnownAssetModifiedAt(info?.modifiedAt);
    return {
      ...entry,
      size: options.forceStat ? infoSize : entrySize ?? infoSize,
      modifiedAt: options.forceStat ? infoModifiedAt : entryModifiedAt ?? infoModifiedAt,
    };
  });
}

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  });

  await Promise.all(workers);
  return results;
}

async function normalizeAssetDirectoryEntries(
  targetDir: string,
  entries: Array<{ name: string; path: string; isFile: boolean; size?: number; modifiedAt?: number }>,
): Promise<NormalizedAssetDirectoryEntry[]> {
  const normalizedEntries: NormalizedAssetDirectoryEntry[] = [];
  for (const entry of entries) {
    const normalizedEntry = await normalizeAssetDirectoryEntry(targetDir, entry);
    if (normalizedEntry) {
      normalizedEntries.push(normalizedEntry);
    }
  }
  return normalizedEntries;
}

function isImageAssetDirectoryEntry(entry: NormalizedAssetDirectoryEntry): boolean {
  return getMimeType(entry.name).startsWith('image/');
}

function getAssetDirectoryEntryPriority(
  entry: NormalizedAssetDirectoryEntry,
  uploadFilename?: string,
): number {
  if (uploadFilename && isSameAssetName(entry.name, uploadFilename)) {
    return 0;
  }

  return isImageAssetDirectoryEntry(entry) ? 1 : 2;
}

function selectAssetDirectoryEntries(
  entries: NormalizedAssetDirectoryEntry[],
  uploadFilename?: string,
): NormalizedAssetDirectoryEntry[] {
  const buckets = Array.from(
    { length: ASSET_DIRECTORY_ENTRY_PRIORITY_BUCKETS },
    () => [] as NormalizedAssetDirectoryEntry[],
  );
  for (const entry of entries) {
    buckets[getAssetDirectoryEntryPriority(entry, uploadFilename)]?.push(entry);
  }
  return buckets.flat().slice(0, MAX_ASSET_LIST_DIRECTORY_ENTRIES);
}

function normalizeSafeSubfolderName(name: string | undefined, fallback: string): string {
  const normalized = (name || fallback).replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (
    parts.length === 0 ||
    parts.some((part) => !isSafeVaultPathSegment(part)) ||
    hasInternalNoteAssetPathSegment(parts.join('/'))
  ) {
    return fallback;
  }

  return parts.join('/');
}

function hasUnsafeCurrentNotePathSegment(path: string): boolean {
  return hasUnsafeVaultPathSegment(path, {
    allowNavigationSegments: true,
  });
}

async function resolveContainedTargetDir(rootPath: string, subfolderName: string): Promise<string> {
  const candidate = normalizeContainedAssetPath(await joinPath(rootPath, subfolderName), rootPath);
  if (!candidate) {
    throw new Error('Asset target folder must stay inside the current note location.');
  }

  return candidate;
}

async function resolveCurrentNoteDir(vaultPath: string, currentNotePath: string): Promise<string> {
  if (hasInternalNoteAssetPathSegment(currentNotePath)) {
    throw new Error('Current note path must not be inside an internal notes folder.');
  }
  if (hasUnsafeCurrentNotePathSegment(currentNotePath)) {
    throw new Error('Current note path contains unsupported characters.');
  }

  if (isAbsolutePath(currentNotePath)) {
    return getParentPath(currentNotePath) || vaultPath;
  }

  const absoluteNotePath = normalizeContainedAssetPath(await joinPath(vaultPath, currentNotePath), vaultPath);
  if (!absoluteNotePath) {
    throw new Error('Current note path must stay inside the current vault.');
  }

  return getParentPath(absoluteNotePath) || vaultPath;
}

export class AssetService {
  static async list(
    context: AssetContext,
    config: AssetConfig
  ): Promise<AssetEntry[]> {
    const { targetDir, storedPathPrefix } = await this.resolveTarget('', context, config);
    const storage = getStorageAdapter();

    if (!await storage.exists(targetDir)) {
      return [];
    }

    const normalizedEntries = await normalizeAssetDirectoryEntries(targetDir, await storage.listDir(targetDir));
    const entries = selectAssetDirectoryEntries(normalizedEntries);
    const imageFiles = entries.filter(isImageAssetDirectoryEntry);

    const assets = imageFiles.map((entry): AssetEntry => ({
      filename: storedPathPrefix + entry.name,
      hash: '',
      size: entry.size ?? 0,
      mimeType: getMimeType(entry.name),
      uploadedAt: entry.modifiedAt ? new Date(entry.modifiedAt).toISOString() : '',
    }));

    return assets.sort((a, b) => b.filename.localeCompare(a.filename));
  }

  static async upload(
    file: File,
    context: AssetContext,
    config: AssetConfig,
    existingAssets: AssetEntry[],
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const initialUploadSize = getKnownAssetSize(file.size);
    if (initialUploadSize === undefined || initialUploadSize > MAX_ASSET_SIZE) {
      return {
        success: false,
        path: null,
        isDuplicate: false,
        error: createAssetSizeError(file.size),
      };
    }
    
    const uploadMimeType = normalizeUploadImageMimeType(file.type);
    if (!uploadMimeType) {
      return { 
        success: false, 
        path: null, 
        isDuplicate: false, 
        error: `Invalid file type: ${file.type}. Only images are allowed.` 
      };
    }

    onProgress?.(20);

    onProgress?.(40);

    const uploadFilename = getUploadFilename(file, uploadMimeType);
    let preparedUploadBytesPromise: Promise<Uint8Array> | null = null;
    const readPreparedUploadBytes = () => {
      if (!preparedUploadBytesPromise) {
        preparedUploadBytesPromise = file.arrayBuffer()
          .then((buffer) => prepareUploadBytes(new Uint8Array(buffer), uploadMimeType));
      }
      return preparedUploadBytesPromise;
    };
    let uploadSize = initialUploadSize;
    if (uploadMimeType === 'image/svg+xml') {
      const preparedBytes = await readPreparedUploadBytes();
      if (preparedBytes.byteLength > MAX_ASSET_SIZE) {
        return {
          success: false,
          path: null,
          isDuplicate: false,
          error: `File is too large (${(preparedBytes.byteLength / 1024 / 1024).toFixed(1)}MB). Limit is 50MB.`,
        };
      }
      uploadSize = preparedBytes.byteLength;
    }
    const { targetDir, storedPathPrefix } = await this.resolveTarget(uploadFilename, context, config);
    const storage = getStorageAdapter();

    if (!await storage.exists(targetDir)) {
      await storage.mkdir(targetDir, true);
    }

    let existingEntries: NormalizedAssetDirectoryEntry[] = [];
    let existingFiles: string[] = [];
    try {
      const normalizedEntries = await normalizeAssetDirectoryEntries(targetDir, await storage.listDir(targetDir));
      existingEntries = selectAssetDirectoryEntries(normalizedEntries, uploadFilename);
      existingFiles = normalizedEntries.map(f => f.name);
    } catch (error) {
      existingFiles = existingAssets.map(a => a.filename.split('/').pop() || '');
    }

    const sameNameImageEntries = existingEntries.filter((entry) => {
      if (!getMimeType(entry.name).startsWith('image/')) return false;
      return isSameAssetName(entry.name, uploadFilename);
    });
    const hydratedImageEntries = await hydrateAssetEntryMetadata(storage, sameNameImageEntries, { forceStat: true });
    const sameSizeCandidates = hydratedImageEntries.filter((entry) => {
      if (typeof entry.size !== 'number' || entry.size !== uploadSize) return false;
      return getMimeType(entry.name).startsWith('image/');
    });
    let fileHash: string | null = null;
    if (sameSizeCandidates.length > 0) {
      fileHash = uploadMimeType === 'image/svg+xml'
        ? await computeBufferHash(await readPreparedUploadBytes())
        : await computeFileHash(file);
      let hashIndex = await loadAssetHashIndex(context.vaultPath);
      let hashIndexChanged = false;

      for (const candidate of sameSizeCandidates) {
        const candidateFilename = storedPathPrefix + candidate.name;
        const indexed = getAssetHashIndexEntry(hashIndex, candidateFilename);
        if (indexed && isIndexedAssetFresh(candidate, indexed)) {
          if (indexed.hash === fileHash) {
            onProgress?.(100);
            return {
              success: true,
              path: candidateFilename,
              isDuplicate: true,
              existingFilename: candidateFilename,
              entry: {
                filename: candidateFilename,
                hash: indexed.hash,
                size: indexed.size,
                mimeType: indexed.mimeType,
                uploadedAt: indexed.updatedAt,
              },
            };
          }
          continue;
        }

        const candidateBytes = await storage.readBinaryFile(candidate.path, MAX_ASSET_SIZE).catch(() => null);
        if (!candidateBytes) {
          continue;
        }
        if (candidateBytes.byteLength !== uploadSize || candidateBytes.byteLength > MAX_ASSET_SIZE) {
          continue;
        }

        const candidateHash = await computeBufferHash(candidateBytes);
        setAssetHashIndexEntry(hashIndex, {
          filename: candidateFilename,
          hash: candidateHash,
          size: candidate.size ?? 0,
          modifiedAt: getKnownAssetModifiedAt(candidate.modifiedAt) ?? null,
          mimeType: getMimeType(candidate.name),
          updatedAt: new Date().toISOString(),
        });
        hashIndexChanged = true;

        if (candidateHash === fileHash) {
          await saveAssetHashIndexBestEffort(context.vaultPath, hashIndex);
          onProgress?.(100);
          return {
            success: true,
            path: candidateFilename,
            isDuplicate: true,
            existingFilename: candidateFilename,
            entry: {
              filename: candidateFilename,
              hash: candidateHash,
              size: candidate.size ?? uploadSize,
              mimeType: getMimeType(candidate.name),
              uploadedAt: new Date().toISOString(),
            },
          };
        }
      }

      if (hashIndexChanged) {
        await saveAssetHashIndexBestEffort(context.vaultPath, hashIndex);
      }
    }

    const existingNames = new Set(existingFiles);
    
    let effectiveFormat = config.filenameFormat;
    const isGenericName = uploadFilename.toLowerCase() === 'image.png';
    const isClipboardTimestamp = Math.abs(Date.now() - file.lastModified) < 2000;

    if (config.filenameFormat === 'original' && isGenericName && isClipboardTimestamp) {
      effectiveFormat = 'timestamp';
    }

    const finalFilename = generateFilename(uploadFilename, effectiveFormat, existingNames);

    onProgress?.(60);

    const buffer = await readPreparedUploadBytes();
    if (buffer.byteLength > MAX_ASSET_SIZE) {
      return {
        success: false,
        path: null,
        isDuplicate: false,
        error: `File is too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Limit is 50MB.`,
      };
    }

    const filePath = await joinPath(targetDir, finalFilename);

    await writeAssetAtomic(filePath, buffer);
    const writtenInfo = await storage.stat(filePath).catch(() => null);
    
    onProgress?.(80);

    const storedFilename = storedPathPrefix + finalFilename;
    const newEntry: AssetEntry = {
      filename: storedFilename,
      hash: fileHash ?? '',
      size: uploadSize,
      mimeType: getMimeType(finalFilename),
      uploadedAt: new Date().toISOString(),
    };

    if (fileHash) {
      const hashIndex = await loadAssetHashIndex(context.vaultPath);
      setAssetHashIndexEntry(hashIndex, {
        filename: storedFilename,
        hash: fileHash,
        size: uploadSize,
        modifiedAt: getKnownAssetModifiedAt(writtenInfo?.modifiedAt) ?? null,
        mimeType: newEntry.mimeType,
        updatedAt: newEntry.uploadedAt,
      });
      await saveAssetHashIndexBestEffort(context.vaultPath, hashIndex);
    }

    onProgress?.(100);

    return {
      success: true,
      path: storedFilename,
      isDuplicate: false,
      entry: newEntry
    };
  }

  private static async resolveTarget(
    _fileName: string, 
    context: AssetContext, 
    config: AssetConfig
  ): Promise<{ targetDir: string; storedPathPrefix: string }> {
    const { vaultPath, currentNotePath } = context;

    switch (config.storageMode) {
      case 'vault':
      default:
        return {
          targetDir: vaultPath,
          storedPathPrefix: ''
        };

      case 'vaultSubfolder':
        const vaultSubfolderName = normalizeSafeSubfolderName(config.imageVaultSubfolderName, 'assets');
        return {
          targetDir: await resolveContainedTargetDir(vaultPath, vaultSubfolderName),
          storedPathPrefix: `${vaultSubfolderName}/`
        };

      case 'currentFolder':
        if (currentNotePath) {
          const currentDir = await resolveCurrentNoteDir(vaultPath, currentNotePath);

          return {
            targetDir: currentDir,
            storedPathPrefix: './'
          };
        } else {
           return {
             targetDir: vaultPath,
             storedPathPrefix: ''
           };
        }

      case 'subfolder':
        if (currentNotePath) {
          const noteDir = await resolveCurrentNoteDir(vaultPath, currentNotePath);
          const subfolderName = normalizeSafeSubfolderName(config.subfolderName, 'assets');

          return {
            targetDir: await resolveContainedTargetDir(noteDir, subfolderName),
            storedPathPrefix: `./${subfolderName}/`
          };
        } else {
           return {
             targetDir: vaultPath,
             storedPathPrefix: ''
           };
        }
    }
  }
}
