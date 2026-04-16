import { AssetEntry, UploadResult } from './types';
import { getStorageAdapter, getParentPath, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { computeFileHash } from './core/hashing';
import { getMimeType, generateFilename } from './core/naming';
import { writeAssetAtomic } from './io/writer';

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

const MAX_ASSET_SIZE = 10 * 1024 * 1024; // 10MB

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
        error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Limit is 10MB.` 
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
        const vaultSubfolderName = config.imageVaultSubfolderName || 'assets';
        return {
          targetDir: await joinPath(vaultPath, vaultSubfolderName),
          storedPathPrefix: `${vaultSubfolderName}/`
        };

      case 'currentFolder':
        if (currentNotePath) {
          const absoluteNotePath = isAbsolutePath(currentNotePath)
            ? currentNotePath
            : await joinPath(vaultPath, currentNotePath);
          const currentDir = getParentPath(absoluteNotePath) || vaultPath;

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
          const absoluteNotePath = isAbsolutePath(currentNotePath)
            ? currentNotePath
            : await joinPath(vaultPath, currentNotePath);
          const noteDir = getParentPath(absoluteNotePath) || vaultPath;
          const subfolderName = config.subfolderName || 'assets';
          
          return {
            targetDir: await joinPath(noteDir, subfolderName),
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
