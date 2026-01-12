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

const ASSETS_DIR = '.nekotick/assets/covers';

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
}

export const createAssetSlice: StateCreator<NotesStore, [], [], AssetSlice> = (set, get) => ({
  assetList: [],
  isLoadingAssets: false,
  uploadProgress: null,

  loadAssets: async (vaultPath: string) => {
    set({ isLoadingAssets: true });
    const storage = getStorageAdapter();

    try {
      const assetsDir = await joinPath(vaultPath, ASSETS_DIR);

      // Ensure directory exists
      if (!await storage.exists(assetsDir)) {
        await storage.mkdir(assetsDir, true);
        set({ assetList: [], isLoadingAssets: false });
        return;
      }

      // Scan directory
      const entries = await storage.listDir(assetsDir);
      const assets: AssetEntry[] = [];

      for (const entry of entries) {
        // Skip directories and temp files
        if (entry.isDirectory || entry.name.endsWith('.tmp')) {
          continue;
        }

        // Check if it's an image file
        const mimeType = getMimeType(entry.name);
        if (!mimeType.startsWith('image/')) {
          continue;
        }

        assets.push({
          filename: entry.name,
          hash: '',
          size: 0,
          mimeType,
          uploadedAt: new Date().toISOString(),
        });
      }

      // Sort by filename (which includes timestamp for our uploads)
      assets.sort((a, b) => b.filename.localeCompare(a.filename));

      set({ assetList: assets, isLoadingAssets: false });
    } catch (error) {
      console.error('Failed to load assets:', error);
      set({ assetList: [], isLoadingAssets: false });
    }
  },

  uploadAsset: async (file: File): Promise<UploadResult> => {
    const { notesPath, assetList } = get();
    const storage = getStorageAdapter();

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
      const filePath = await joinPath(assetsDir, filename);

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
});
