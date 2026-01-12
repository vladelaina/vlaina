/**
 * Asset Slice - Asset library management for notes
 */

import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import { getNotesBasePath } from '../storage';
import { 
  AssetIndex, 
  AssetEntry, 
  UploadResult, 
  createEmptyIndex 
} from '@/lib/assets/types';
import { computeFileHash } from '@/lib/assets/hashService';
import { processFilename, getMimeType } from '@/lib/assets/filenameService';
import { writeAssetAtomic, cleanupTempFiles } from '@/lib/assets/atomicWrite';

const ASSETS_DIR = '.nekotick/assets/covers';
const STORE_DIR = '.nekotick/store';
const INDEX_FILE = 'covers.json';

export interface AssetSlice {
  // State
  assetIndex: AssetIndex | null;
  isLoadingAssets: boolean;
  uploadProgress: number | null;

  // Actions
  loadAssetIndex: (vaultPath: string) => Promise<void>;
  uploadAsset: (file: File) => Promise<UploadResult>;
  deleteAsset: (filename: string) => Promise<void>;
  getUnusedAssets: () => Promise<string[]>;
  cleanUnusedAssets: () => Promise<number>;
  cleanupAssetTempFiles: () => Promise<void>;
  getAssetList: () => AssetEntry[];
}

export const createAssetSlice: StateCreator<NotesStore, [], [], AssetSlice> = (set, get) => ({
  assetIndex: null,
  isLoadingAssets: false,
  uploadProgress: null,

  loadAssetIndex: async (vaultPath: string) => {
    set({ isLoadingAssets: true });
    const storage = getStorageAdapter();

    try {
      const assetsDir = await joinPath(vaultPath, ASSETS_DIR);
      const storeDir = await joinPath(vaultPath, STORE_DIR);
      const indexPath = await joinPath(storeDir, INDEX_FILE);

      // Ensure directories exist
      if (!await storage.exists(assetsDir)) {
        await storage.mkdir(assetsDir, true);
      }
      if (!await storage.exists(storeDir)) {
        await storage.mkdir(storeDir, true);
      }

      // Load or create index
      let index: AssetIndex;
      if (await storage.exists(indexPath)) {
        try {
          const content = await storage.readFile(indexPath);
          index = JSON.parse(content);
          
          // Validate index structure
          if (!index.version || !index.assets || !index.hashMap) {
            throw new Error('Invalid index structure');
          }
        } catch (e) {
          console.warn('Asset index corrupted, rebuilding...', e);
          // Backup corrupted file
          try {
            const backupPath = await joinPath(storeDir, 'covers.json.bak');
            const content = await storage.readFile(indexPath);
            await storage.writeFile(backupPath, content);
          } catch {
            // Ignore backup errors
          }
          // Rebuild index
          index = await rebuildIndex(assetsDir);
        }
      } else {
        index = createEmptyIndex();
        await storage.writeFile(indexPath, JSON.stringify(index, null, 2));
      }

      set({ assetIndex: index, isLoadingAssets: false });
    } catch (error) {
      console.error('Failed to load asset index:', error);
      set({ assetIndex: createEmptyIndex(), isLoadingAssets: false });
    }
  },

  uploadAsset: async (file: File): Promise<UploadResult> => {
    const { assetIndex, notesPath } = get();
    const storage = getStorageAdapter();

    try {
      const vaultPath = notesPath || await getNotesBasePath();
      const assetsDir = await joinPath(vaultPath, ASSETS_DIR);
      const storeDir = await joinPath(vaultPath, STORE_DIR);
      const indexPath = await joinPath(storeDir, INDEX_FILE);

      // Ensure directories exist
      if (!await storage.exists(assetsDir)) {
        await storage.mkdir(assetsDir, true);
      }
      if (!await storage.exists(storeDir)) {
        await storage.mkdir(storeDir, true);
      }

      // Load index if not loaded
      let index = assetIndex;
      if (!index) {
        await get().loadAssetIndex(vaultPath);
        index = get().assetIndex;
      }
      if (!index) {
        index = createEmptyIndex();
      }

      set({ uploadProgress: 10 });

      // Compute hash
      const hash = await computeFileHash(file);
      set({ uploadProgress: 40 });

      // Check for duplicate
      if (index.hashMap[hash]) {
        const existingFilename = index.hashMap[hash];
        set({ uploadProgress: null });
        return {
          success: true,
          path: existingFilename,  // Return only filename
          isDuplicate: true,
          existingFilename,
        };
      }

      set({ uploadProgress: 50 });

      // Process filename
      const existingNames = new Set(Object.keys(index.assets));
      const filename = processFilename(file.name, existingNames);

      set({ uploadProgress: 60 });

      // Write file atomically
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const filePath = await joinPath(assetsDir, filename);
      
      await writeAssetAtomic(filePath, data);
      set({ uploadProgress: 80 });

      // Update index
      const entry: AssetEntry = {
        filename,
        hash,
        size: file.size,
        mimeType: getMimeType(filename),
        uploadedAt: new Date().toISOString(),
      };

      const updatedIndex: AssetIndex = {
        ...index,
        assets: { ...index.assets, [filename]: entry },
        hashMap: { ...index.hashMap, [hash]: filename },
      };

      await storage.writeFile(indexPath, JSON.stringify(updatedIndex, null, 2));
      set({ assetIndex: updatedIndex, uploadProgress: 100 });

      // Clear progress after a short delay
      setTimeout(() => set({ uploadProgress: null }), 500);

      return {
        success: true,
        path: filename,  // Return only filename
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
    const { assetIndex, notesPath } = get();
    const storage = getStorageAdapter();

    if (!assetIndex) return;

    try {
      const vaultPath = notesPath || await getNotesBasePath();
      const assetsDir = await joinPath(vaultPath, ASSETS_DIR);
      const storeDir = await joinPath(vaultPath, STORE_DIR);
      const indexPath = await joinPath(storeDir, INDEX_FILE);
      const filePath = await joinPath(assetsDir, filename);

      // Get entry to find hash
      const entry = assetIndex.assets[filename];
      if (!entry) return;

      // Delete file
      if (await storage.exists(filePath)) {
        await storage.deleteFile(filePath);
      }

      // Update index
      const { [filename]: _, ...remainingAssets } = assetIndex.assets;
      const { [entry.hash]: __, ...remainingHashMap } = assetIndex.hashMap;

      const updatedIndex: AssetIndex = {
        ...assetIndex,
        assets: remainingAssets,
        hashMap: remainingHashMap,
      };

      await storage.writeFile(indexPath, JSON.stringify(updatedIndex, null, 2));
      set({ assetIndex: updatedIndex });
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  },

  getUnusedAssets: async (): Promise<string[]> => {
    const { assetIndex, noteContentsCache, rootFolder } = get();
    
    if (!assetIndex || Object.keys(assetIndex.assets).length === 0) {
      return [];
    }

    // If cache is empty, scan notes first
    let cache = noteContentsCache;
    if (cache.size === 0 && rootFolder) {
      await get().scanAllNotes();
      cache = get().noteContentsCache;
    }

    // Combine all note contents
    const allContent = Array.from(cache.values()).join('\n');

    // Find unused assets (check by filename only)
    const unused: string[] = [];
    for (const filename of Object.keys(assetIndex.assets)) {
      if (!allContent.includes(filename)) {
        unused.push(filename);
      }
    }

    return unused;
  },

  cleanUnusedAssets: async (): Promise<number> => {
    const unused = await get().getUnusedAssets();
    
    for (const filename of unused) {
      await get().deleteAsset(filename);
    }

    return unused.length;
  },

  cleanupAssetTempFiles: async () => {
    const { notesPath } = get();
    const vaultPath = notesPath || await getNotesBasePath();
    const assetsDir = await joinPath(vaultPath, ASSETS_DIR);
    
    await cleanupTempFiles(assetsDir);
  },

  getAssetList: (): AssetEntry[] => {
    const { assetIndex } = get();
    if (!assetIndex) return [];

    // Return sorted by uploadedAt descending (newest first)
    return Object.values(assetIndex.assets)
      .sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
  },
});

/**
 * Rebuild index by scanning assets directory
 */
async function rebuildIndex(assetsDir: string): Promise<AssetIndex> {
  const storage = getStorageAdapter();
  const index = createEmptyIndex();

  try {
    const entries = await storage.listDir(assetsDir);

    for (const entry of entries) {
      // Skip index file and temp files
      if (entry.name === INDEX_FILE || entry.name.endsWith('.tmp')) {
        continue;
      }

      try {
        const filePath = `${assetsDir}/${entry.name}`;
        const content = await storage.readBinaryFile(filePath);
        // Create a copy to ensure proper ArrayBuffer type for Blob
        const copy = new Uint8Array(content);
        const blob = new Blob([copy]);
        const hash = await computeFileHash(new File([blob], entry.name));

        const assetEntry: AssetEntry = {
          filename: entry.name,
          hash,
          size: content.length,
          mimeType: getMimeType(entry.name),
          uploadedAt: new Date().toISOString(),
        };

        index.assets[entry.name] = assetEntry;
        index.hashMap[hash] = entry.name;
      } catch {
        // Skip files that can't be read
      }
    }
  } catch {
    // Directory might be empty or inaccessible
  }

  return index;
}
