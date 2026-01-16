/**
 * Asset Slice - Asset library management for notes
 * Simplified: directly scans directory instead of maintaining index file
 */

import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import { getNotesBasePath } from '../storage';
import { AssetEntry, UploadResult } from '@/lib/assets/types';
import { processFilename, getMimeType } from '@/lib/assets/filenameService';
import { writeAssetAtomic, cleanupTempFiles } from '@/lib/assets/atomicWrite';
import { clearImageCache } from '@/lib/assets/imageLoader';
import { getBuiltinCovers, toBuiltinAssetPath } from '@/lib/assets/builtinCovers';

const ASSETS_DIR = '.nekotick/assets/covers';
const MAX_ASSET_SIZE = 10 * 1024 * 1024; // 10MB Limit

export interface AssetSlice {
  // State
  assetList: AssetEntry[];
  isLoadingAssets: boolean;
  uploadProgress: number | null;

  // Actions
  loadAssets: (vaultPath: string) => Promise<void>;
  uploadAsset: (file: File) => Promise<UploadResult>;
  deleteAsset: (filename: string) => Promise<void>;
  cleanupAssetTempFiles: () => Promise<void>;
  getAssetList: () => AssetEntry[];
  clearAssetUrlCache: () => void;
}

export const createAssetSlice: StateCreator<NotesStore, [], [], AssetSlice> = (set, get) => ({
  assetList: [],
  isLoadingAssets: false,
  uploadProgress: null,

  loadAssets: async (vaultPath: string) => {
    // Clear previous blob URLs to free memory when switching vaults
    clearImageCache();

    set({ isLoadingAssets: true });
    const storage = getStorageAdapter();

    try {
      const assetsDir = await joinPath(vaultPath, ASSETS_DIR);

      // Ensure directory exists
      if (!await storage.exists(assetsDir)) {
        await storage.mkdir(assetsDir, true);
      }

      const assets: AssetEntry[] = [];

      // Recursive function to scan directories
      async function scanDirectory(dirPath: string, relativePath: string = '') {
        const entries = await storage.listDir(dirPath);

        for (const entry of entries) {
          // Skip temp files
          if (entry.name.endsWith('.tmp')) {
            continue;
          }

          if (entry.isDirectory) {
            // Recursively scan subdirectories
            const subDirPath = await joinPath(dirPath, entry.name);
            const subRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            await scanDirectory(subDirPath, subRelativePath);
          } else {
            // Check if it's an image file
            const mimeType = getMimeType(entry.name);
            if (!mimeType.startsWith('image/')) {
              continue;
            }

            // Store relative path from assets dir (e.g., "subfolder/image.png")
            const filename = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            assets.push({
              filename,
              hash: '',
              size: 0,
              mimeType,
              uploadedAt: new Date().toISOString(),
            });
          }
        }
      }

      await scanDirectory(assetsDir);

      // Add built-in covers
      const builtinCovers = getBuiltinCovers();
      for (const cover of builtinCovers) {
        assets.push({
          filename: toBuiltinAssetPath(cover),
          hash: '',
          size: 0,
          mimeType: 'image/webp',
          uploadedAt: '',
        });
      }

      // Sort: user uploads first, then built-in covers
      // User uploads have no prefix, built-in have "@" prefix
      assets.sort((a, b) => {
        const aIsBuiltIn = a.filename.startsWith('@');
        const bIsBuiltIn = b.filename.startsWith('@');

        // User uploads come first
        if (aIsBuiltIn !== bIsBuiltIn) {
          return aIsBuiltIn ? 1 : -1;
        }

        // Within same group, sort by filename descending
        return b.filename.localeCompare(a.filename);
      });

      set({ assetList: assets, isLoadingAssets: false });
    } catch (error) {
      console.error('Failed to load assets:', error);
      set({ assetList: [], isLoadingAssets: false });
    }
  },

  uploadAsset: async (file: File): Promise<UploadResult> => {
    const { notesPath, assetList } = get();
    const storage = getStorageAdapter();

    // --- Validation Gate ---
    // 1. Check File Size (10MB Limit)
    if (file.size > MAX_ASSET_SIZE) {
      const msg = `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Limit is 10MB.`;
      console.warn(msg);
      return {
        success: false,
        path: null,
        isDuplicate: false,
        error: msg
      };
    }

    // 2. Check MIME Type
    if (!file.type.startsWith('image/')) {
      const msg = `Invalid file type: ${file.type}. Only images are allowed.`;
      console.warn(msg);
      return {
        success: false,
        path: null,
        isDuplicate: false,
        error: msg
      };
    }
    // -----------------------

    try {
      const vaultPath = notesPath || await getNotesBasePath();
      const assetsDir = await joinPath(vaultPath, ASSETS_DIR);

      // Ensure directory exists
      if (!await storage.exists(assetsDir)) {
        await storage.mkdir(assetsDir, true);
      }

      set({ uploadProgress: 20 });

      // Process filename (generates timestamp-based name)
      const existingNames = new Set(assetList.map(a => a.filename));
      const filename = processFilename(file.name, existingNames);

      set({ uploadProgress: 50 });

      // Write file atomically
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const filePath = await joinPath(assetsDir, filename);

      await writeAssetAtomic(filePath, data);
      set({ uploadProgress: 80 });

      // Update local state
      const newEntry: AssetEntry = {
        filename,
        hash: '',
        size: file.size,
        mimeType: getMimeType(filename),
        uploadedAt: new Date().toISOString(),
      };

      set({
        assetList: [newEntry, ...assetList],
        uploadProgress: 100
      });

      // Clear progress after a short delay
      setTimeout(() => set({ uploadProgress: null }), 500);

      return {
        success: true,
        path: filename,
        isDuplicate: false,
      };
    } catch (error) {
      set({ uploadProgress: null });
      console.error('Failed to upload asset:', error);
      return {
        success: false,
        path: null,
        isDuplicate: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  },

  deleteAsset: async (filename: string) => {
    const { notesPath, assetList } = get();
    const storage = getStorageAdapter();

    try {
      const vaultPath = notesPath || await getNotesBasePath();
      const assetsDir = await joinPath(vaultPath, ASSETS_DIR);

      // filename may contain subdirectory path (e.g., "subfolder/image.png")
      // Convert forward slashes to OS-native separator
      const separator = vaultPath.includes('\\') ? '\\' : '/';
      const normalizedFilename = filename.replace(/\//g, separator);
      const filePath = await joinPath(assetsDir, normalizedFilename);

      // Delete file
      if (await storage.exists(filePath)) {
        await storage.deleteFile(filePath);
      }

      // Update local state
      set({ assetList: assetList.filter(a => a.filename !== filename) });
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  },

  cleanupAssetTempFiles: async () => {
    const { notesPath } = get();
    const vaultPath = notesPath || await getNotesBasePath();
    const assetsDir = await joinPath(vaultPath, ASSETS_DIR);

    await cleanupTempFiles(assetsDir);
  },

  getAssetList: (): AssetEntry[] => {
    return get().assetList;
  },

  clearAssetUrlCache: () => {
    clearImageCache();
  },
});
