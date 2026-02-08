import { AssetEntry, UploadResult } from './types';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { computeFileHash } from './core/hashing';
import { getMimeType, generateFilename } from './core/naming';
import { writeAssetAtomic } from './io/writer';

export interface AssetContext {
  vaultPath: string;
  currentNotePath?: string;
  category?: 'covers' | 'icons' | 'content';
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
    
    // 1. Validation
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

    // 2. Hash Calculation & Deduplication
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

    // 3. Path Resolution
    const { targetDir, storedPathPrefix } = await this.resolveTarget(file.name, context, config);
    const storage = getStorageAdapter();

    if (!await storage.exists(targetDir)) {
      await storage.mkdir(targetDir, true);
    }

    // 4. Filename Conflict Resolution
    let existingFiles: string[] = [];
    try {
      const files = await storage.listDir(targetDir);
      existingFiles = files.filter(f => f.isFile).map(f => f.name);
    } catch (error) {
      console.warn('Failed to list directory for conflict resolution, falling back to asset list', error);
      existingFiles = existingAssets.map(a => a.filename.split('/').pop() || '');
    }

    const existingNames = new Set(existingFiles);
    
    // Check for special "image.png" case for clipboard pastes
    let effectiveFormat = config.filenameFormat;
    const isGenericName = file.name.toLowerCase() === 'image.png';
    const isClipboardTimestamp = Math.abs(Date.now() - file.lastModified) < 2000;

    if (config.filenameFormat === 'original' && isGenericName && isClipboardTimestamp) {
      effectiveFormat = 'timestamp';
    }

    const finalFilename = generateFilename(file.name, effectiveFormat, existingNames);

    onProgress?.(60);

    // 5. Write to Disk
    const buffer = new Uint8Array(await file.arrayBuffer());
    
    // Use Tauri's join here too for consistency
    const { join } = await import('@tauri-apps/api/path');
    const filePath = await join(targetDir, finalFilename);
    
    await writeAssetAtomic(filePath, buffer);
    
    onProgress?.(80);

    // 6. Return Result
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
    const { vaultPath, currentNotePath, category } = context;
    const { join, dirname } = await import('@tauri-apps/api/path');
    
    // System assets (Icons/Covers) always go to .nekotick/assets
    if (category === 'icons') {
      const assetsBaseDir = await join(vaultPath, '.nekotick', 'assets');
      return {
        targetDir: await join(assetsBaseDir, 'icons'),
        storedPathPrefix: 'icons/'
      };
    }
    
    if (category === 'covers') {
       const assetsBaseDir = await join(vaultPath, '.nekotick', 'assets');
       return {
         targetDir: await join(assetsBaseDir, 'covers'),
         storedPathPrefix: ''
       };
    }

    // Standard image upload logic (category === 'content' or undefined)
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
          targetDir: await join(vaultPath, vaultSubfolderName),
          storedPathPrefix: `${vaultSubfolderName}/`
        };

      case 'currentFolder':
        if (currentNotePath) {
          // currentNotePath might be relative to vault, so resolve it first
          const isAbsolute = currentNotePath.startsWith('/') || /^[a-zA-Z]:/.test(currentNotePath);
          const absoluteNotePath = isAbsolute ? currentNotePath : await join(vaultPath, currentNotePath);
          
          const currentDir = await dirname(absoluteNotePath);

          return {
            targetDir: currentDir,
            storedPathPrefix: './' // Explicitly relative
          };
        } else {
           // Fallback to vault default
           return {
             targetDir: vaultPath,
             storedPathPrefix: ''
           };
        }

      case 'subfolder':
        if (currentNotePath) {
          const isAbsolute = currentNotePath.startsWith('/') || /^[a-zA-Z]:/.test(currentNotePath);
          const absoluteNotePath = isAbsolute ? currentNotePath : await join(vaultPath, currentNotePath);
          
          const noteDir = await dirname(absoluteNotePath);
          const subfolderName = config.subfolderName || 'assets';
          
          return {
            targetDir: await join(noteDir, subfolderName),
            storedPathPrefix: `./${subfolderName}/`
          };
        } else {
          // Fallback
           return {
             targetDir: vaultPath,
             storedPathPrefix: ''
           };
        }
    }
  }
}