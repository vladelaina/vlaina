import { AssetEntry, UploadResult } from './types';
import { getStorageAdapter, getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { computeFileHash } from './core/hashing';
import { getMimeType, generateFilename } from './core/naming';
import { writeAssetAtomic } from './io/writer';
import { normalizeContainedAssetPath } from './core/pathContainment';

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

    const fileHash = await computeFileHash(file);
    const existingAsset = existingAssets.find(a => a.hash === fileHash);
    
    if (existingAsset) {
      onProgress?.(100);
      return {
        success: true,
        path: existingAsset.filename,
        isDuplicate: true,
        existingFilename: existingAsset.filename,
        entry: existingAsset
      };
    }

    onProgress?.(40);

    const { targetDir, storedPathPrefix } = await this.resolveTarget(file.name, context, config);
    const storage = getStorageAdapter();

    if (!await storage.exists(targetDir)) {
      await storage.mkdir(targetDir, true);
    }

    let existingFiles: string[] = [];
    try {
      const files = await storage.listDir(targetDir);
      existingFiles = files.filter(f => f.isFile).map(f => f.name);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to list directory for conflict resolution, falling back to asset list', error);
      existingFiles = existingAssets.map(a => a.filename.split('/').pop() || '');
    }

    const existingNames = new Set(existingFiles);
    
    let effectiveFormat = config.filenameFormat;
    const isGenericName = file.name.toLowerCase() === 'image.png';
    const isClipboardTimestamp = Math.abs(Date.now() - file.lastModified) < 2000;

    if (config.filenameFormat === 'original' && isGenericName && isClipboardTimestamp) {
      effectiveFormat = 'timestamp';
    }

    const finalFilename = generateFilename(file.name, effectiveFormat, existingNames);

    onProgress?.(60);

    const buffer = new Uint8Array(await file.arrayBuffer());
    
    const filePath = await joinPath(targetDir, finalFilename);
    
    await writeAssetAtomic(filePath, buffer);
    
    onProgress?.(80);

    const storedFilename = storedPathPrefix + finalFilename;
    const newEntry: AssetEntry = {
      filename: storedFilename,
      hash: fileHash,
      size: file.size,
      mimeType: getMimeType(finalFilename),
      uploadedAt: new Date().toISOString(),
    };

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
