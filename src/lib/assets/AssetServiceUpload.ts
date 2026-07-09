import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { generateFilename, getMimeType } from './core/naming';
import { writeAssetAtomic } from './io/writer';
import { sanitizeSvgBytes } from '@/lib/markdown/svgSanitizer';
import {
  getKnownAssetModifiedAt,
  getKnownAssetSize,
  hydrateAssetEntryMetadata,
  isSameAssetName,
  normalizeAssetDirectoryEntries,
  selectAssetDirectoryEntries,
  type NormalizedAssetDirectoryEntry,
} from './AssetServiceDirectory';
import { resolveAssetTarget } from './AssetServicePaths';
import { findDuplicateAsset, saveUploadedAssetHashIndex } from './AssetServiceUploadHashIndex';
import type { AssetEntry, UploadResult } from './types';
import type { AssetConfig, AssetContext } from './AssetServiceTypes';

const MAX_ASSET_SIZE = 50 * 1024 * 1024;
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

function createAssetSizeError(size: number | null | undefined): string {
  const knownSize = getKnownAssetSize(size);
  return knownSize === undefined
    ? 'File size is invalid. Limit is 50MB.'
    : `File is too large (${(knownSize / 1024 / 1024).toFixed(1)}MB). Limit is 50MB.`;
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

function normalizeUploadImageMimeType(value: string, fileName: string): string | null {
  const mimeType = value.split(';')[0]?.trim().toLowerCase() ?? '';
  if (Object.prototype.hasOwnProperty.call(IMAGE_UPLOAD_EXTENSIONS_BY_MIME, mimeType)) {
    return mimeType;
  }

  if (mimeType && mimeType !== 'application/octet-stream') {
    return null;
  }

  const inferredMimeType = getMimeType(fileName);
  return Object.prototype.hasOwnProperty.call(IMAGE_UPLOAD_EXTENSIONS_BY_MIME, inferredMimeType)
    ? inferredMimeType
    : null;
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

function createAssetEntry(
  filename: string,
  hash: string,
  size: number,
  mimeType: string,
): AssetEntry {
  return {
    filename,
    hash,
    size,
    mimeType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function uploadAssetFile(
  file: File,
  context: AssetContext,
  config: AssetConfig,
  existingAssets: AssetEntry[],
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const initialUploadSize = getKnownAssetSize(file.size);
  if (initialUploadSize === undefined || initialUploadSize > MAX_ASSET_SIZE) {
    return { success: false, path: null, isDuplicate: false, error: createAssetSizeError(file.size) };
  }

  const uploadMimeType = normalizeUploadImageMimeType(file.type, file.name);
  if (!uploadMimeType) {
    return { success: false, path: null, isDuplicate: false, error: `Invalid file type: ${file.type}. Only images are allowed.` };
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
      return { success: false, path: null, isDuplicate: false, error: createAssetSizeError(preparedBytes.byteLength) };
    }
    uploadSize = preparedBytes.byteLength;
  }
  const { targetDir, storedPathPrefix } = await resolveAssetTarget(context, config);
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

  const sameNameImageEntries = existingEntries.filter((entry) =>
    getMimeType(entry.name).startsWith('image/') && isSameAssetName(entry.name, uploadFilename)
  );
  const hydratedImageEntries = await hydrateAssetEntryMetadata(storage, sameNameImageEntries, { forceStat: true });
  const sameSizeCandidates = hydratedImageEntries.filter((entry) =>
    typeof entry.size === 'number' && entry.size === uploadSize && getMimeType(entry.name).startsWith('image/')
  );
  let fileHash: string | null = null;
  if (sameSizeCandidates.length > 0) {
    const duplicateLookup = await findDuplicateAsset(
      context,
      storage,
      storedPathPrefix,
      sameSizeCandidates,
      uploadSize,
      uploadMimeType,
      file,
      readPreparedUploadBytes,
      MAX_ASSET_SIZE,
    );
    if (duplicateLookup.duplicate) {
      onProgress?.(100);
      return duplicateLookup.duplicate;
    }
    fileHash = duplicateLookup.fileHash;
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
    return { success: false, path: null, isDuplicate: false, error: createAssetSizeError(buffer.byteLength) };
  }

  const filePath = await joinPath(targetDir, finalFilename);
  await writeAssetAtomic(filePath, buffer);
  const writtenInfo = await storage.stat(filePath).catch(() => null);
  onProgress?.(80);

  const storedFilename = storedPathPrefix + finalFilename;
  const newEntry = createAssetEntry(storedFilename, fileHash ?? '', uploadSize, getMimeType(finalFilename));

  if (fileHash) {
    await saveUploadedAssetHashIndex(context, {
      filename: storedFilename,
      hash: fileHash,
      size: uploadSize,
      modifiedAt: getKnownAssetModifiedAt(writtenInfo?.modifiedAt) ?? null,
      mimeType: newEntry.mimeType,
      updatedAt: newEntry.uploadedAt,
    });
  }

  onProgress?.(100);

  return {
    success: true,
    path: storedFilename,
    isDuplicate: false,
    entry: newEntry
  };
}
