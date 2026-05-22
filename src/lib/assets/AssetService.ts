import { AssetEntry, UploadResult } from './types';
import { getStorageAdapter, getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { computeBufferHash, computeFileHash } from './core/hashing';
import { getMimeType, generateFilename, processFilename } from './core/naming';
import { writeAssetAtomic } from './io/writer';
import { normalizeContainedAssetPath } from './core/pathContainment';
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

function isIndexedAssetFresh(
  entry: { size?: number; modifiedAt?: number | null },
  indexed: { size: number; modifiedAt: number | null },
) {
  return typeof entry.size === 'number' && entry.size === indexed.size && (entry.modifiedAt ?? null) === indexed.modifiedAt;
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

function getUploadFilename(file: File): string {
  const rawName = file.name.trim();
  if (rawName) {
    return rawName;
  }

  return `image${getImageExtensionFromMimeType(file.type)}`;
}

function isSameAssetName(entryName: string, fileName: string): boolean {
  return entryName.toLowerCase() === getOriginalStoredFilename(fileName).toLowerCase();
}

async function hydrateAssetEntryMetadata(
  storage: ReturnType<typeof getStorageAdapter>,
  entries: Array<{ name: string; path: string; size?: number; modifiedAt?: number }>,
) {
  return Promise.all(entries.map(async (entry) => {
    if (typeof entry.size === 'number' && typeof entry.modifiedAt === 'number') {
      return entry;
    }

    const info = await storage.stat(entry.path).catch(() => null);
    return {
      ...entry,
      size: typeof entry.size === 'number' ? entry.size : info?.size,
      modifiedAt: typeof entry.modifiedAt === 'number' ? entry.modifiedAt : info?.modifiedAt,
    };
  }));
}

function normalizeSafeSubfolderName(name: string | undefined, fallback: string): string {
  const normalized = (name || fallback).replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..' || part.includes('\0'))) {
    return fallback;
  }

  return parts.join('/');
}

async function resolveContainedTargetDir(rootPath: string, subfolderName: string): Promise<string> {
  const candidate = normalizeContainedAssetPath(await joinPath(rootPath, subfolderName), rootPath);
  if (!candidate) {
    throw new Error('Asset target folder must stay inside the current note location.');
  }

  return candidate;
}

async function resolveCurrentNoteDir(vaultPath: string, currentNotePath: string): Promise<string> {
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

    const entries = await storage.listDir(targetDir);
    const imageFiles = entries.filter((entry) => {
      if (!entry.isFile) return false;
      return getMimeType(entry.name).startsWith('image/');
    });

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
    
    if (file.size > MAX_ASSET_SIZE) {
      return { 
        success: false, 
        path: null, 
        isDuplicate: false, 
        error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Limit is 50MB.`
      };
    }
    
    if (!file.type.startsWith('image/')) {
      return { 
        success: false, 
        path: null, 
        isDuplicate: false, 
        error: `Invalid file type: ${file.type}. Only images are allowed.` 
      };
    }

    onProgress?.(20);

    onProgress?.(40);

    const uploadFilename = getUploadFilename(file);
    const { targetDir, storedPathPrefix } = await this.resolveTarget(uploadFilename, context, config);
    const storage = getStorageAdapter();

    if (!await storage.exists(targetDir)) {
      await storage.mkdir(targetDir, true);
    }

    let existingEntries: Array<{ name: string; path: string; size?: number; modifiedAt?: number }> = [];
    let existingFiles: string[] = [];
    try {
      const files = await storage.listDir(targetDir);
      existingEntries = files.filter(f => f.isFile).map((entry) => ({
        name: entry.name,
        path: entry.path,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
      }));
      existingFiles = existingEntries.map(f => f.name);
    } catch (error) {
      existingFiles = existingAssets.map(a => a.filename.split('/').pop() || '');
    }

    const sameNameImageEntries = existingEntries.filter((entry) => {
      if (!getMimeType(entry.name).startsWith('image/')) return false;
      return isSameAssetName(entry.name, uploadFilename);
    });
    const hydratedImageEntries = await hydrateAssetEntryMetadata(storage, sameNameImageEntries);
    const sameSizeCandidates = hydratedImageEntries.filter((entry) => {
      if (typeof entry.size === 'number' && entry.size !== file.size) return false;
      return getMimeType(entry.name).startsWith('image/');
    });
    let fileHash: string | null = null;
    if (sameSizeCandidates.length > 0) {
      fileHash = await computeFileHash(file);
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

        const candidateHash = await computeBufferHash(await storage.readBinaryFile(candidate.path));
        setAssetHashIndexEntry(hashIndex, {
          filename: candidateFilename,
          hash: candidateHash,
          size: candidate.size ?? 0,
          modifiedAt: candidate.modifiedAt ?? null,
          mimeType: getMimeType(candidate.name),
          updatedAt: new Date().toISOString(),
        });
        hashIndexChanged = true;

        if (candidateHash === fileHash) {
          await saveAssetHashIndex(context.vaultPath, hashIndex);
          onProgress?.(100);
          return {
            success: true,
            path: candidateFilename,
            isDuplicate: true,
            existingFilename: candidateFilename,
            entry: {
              filename: candidateFilename,
              hash: candidateHash,
              size: candidate.size ?? file.size,
              mimeType: getMimeType(candidate.name),
              uploadedAt: new Date().toISOString(),
            },
          };
        }
      }

      if (hashIndexChanged) {
        await saveAssetHashIndex(context.vaultPath, hashIndex);
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

    const buffer = new Uint8Array(await file.arrayBuffer());

    const filePath = await joinPath(targetDir, finalFilename);

    await writeAssetAtomic(filePath, buffer);
    const writtenInfo = await storage.stat(filePath).catch(() => null);
    
    onProgress?.(80);

    const storedFilename = storedPathPrefix + finalFilename;
    const newEntry: AssetEntry = {
      filename: storedFilename,
      hash: fileHash ?? '',
      size: file.size,
      mimeType: getMimeType(finalFilename),
      uploadedAt: new Date().toISOString(),
    };

    if (fileHash) {
      const hashIndex = await loadAssetHashIndex(context.vaultPath);
      setAssetHashIndexEntry(hashIndex, {
        filename: storedFilename,
        hash: fileHash,
        size: file.size,
        modifiedAt: writtenInfo?.modifiedAt ?? null,
        mimeType: newEntry.mimeType,
        updatedAt: newEntry.uploadedAt,
      });
      await saveAssetHashIndex(context.vaultPath, hashIndex);
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
