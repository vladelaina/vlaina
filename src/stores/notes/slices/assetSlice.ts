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

// ASSETS_DIR removed, now using dynamic paths
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
      // We now have two asset directories: covers and icons
      // Base path is .nekotick/assets
      const assetsBaseDir = await joinPath(vaultPath, '.nekotick', 'assets');

      // Ensure base directories exist
      const coversDir = await joinPath(assetsBaseDir, 'covers');
      const iconsDir = await joinPath(assetsBaseDir, 'icons');

      // Create if missing (covers should exist, icons might be new)
      if (!await storage.exists(coversDir)) await storage.mkdir(coversDir, true);
      if (!await storage.exists(iconsDir)) await storage.mkdir(iconsDir, true);

      const assets: AssetEntry[] = [];

      // Unified scan function
      async function scanCategory(dirPath: string, category: 'covers' | 'icons') {
        // Safe check if dir exists (mkdir above ensures it, but safe logic)
        if (!await storage.exists(dirPath)) return;

        const entries = await storage.listDir(dirPath);
        for (const entry of entries) {
          // Skip temp files
          if (entry.name.endsWith('.tmp')) continue;

          if (entry.isDirectory) {
            // We only scan 1 level deep for simplicity in this version, 
            // OR we can keep recursion but flattened filename needs to include subdir?
            // Existing logic supported recursion with relative paths.
            // To keep it compatible: We scan recursively.
            // Limitation: filename in assetList must be unique or we need full path.
            // Existing app relies on 'filename' being unique enough.
            // For icons vs covers, we might have name collision 'logo.png' in both.
            // To solve this, we should prefix filename with category? 
            // NO, existing covers are just 'image.png'. Breaking that breaks existing covers.
            // STRATEGY: 
            // 1. Covers store as 'image.png' (legacy compat)
            // 2. Icons store as 'icons/image.png' ? 
            // Let's explicitly tag them with 'category' in AssetEntry instead.
          } else {
            const mimeType = getMimeType(entry.name);
            if (!mimeType.startsWith('image/')) continue;

            const storedFilename = category === 'icons' ? `icons/${entry.name}` : entry.name;
            assets.push({
              filename: storedFilename,
              hash: '',
              size: 0,
              mimeType,
              uploadedAt: new Date().toISOString(),
            });
          }
        }
      }

      // Scan Covers (legacy location)
      await scanCategory(coversDir, 'covers');

      // Scan Icons (new location)
      await scanCategory(iconsDir, 'icons');

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

      // Sort
      assets.sort((a, b) => {
        // Built-ins last
        const aIsBuiltIn = a.filename.startsWith('@');
        const bIsBuiltIn = b.filename.startsWith('@');
        if (aIsBuiltIn !== bIsBuiltIn) return aIsBuiltIn ? 1 : -1;
        return b.filename.localeCompare(a.filename);
      });

      set({ assetList: assets, isLoadingAssets: false });
    } catch (error) {
      console.error('Failed to load assets:', error);
      set({ assetList: [], isLoadingAssets: false });
    }
  },

  uploadAsset: async (file: File, category: 'covers' | 'icons' = 'covers'): Promise<UploadResult> => {
    const { notesPath, assetList } = get();
    const storage = getStorageAdapter();

    // --- Validation Gate ---
    if (file.size > MAX_ASSET_SIZE) {
      const msg = `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Limit is 10MB.`;
      console.warn(msg);
      return { success: false, path: null, isDuplicate: false, error: msg };
    }
    if (!file.type.startsWith('image/')) {
      const msg = `Invalid file type: ${file.type}. Only images are allowed.`;
      console.warn(msg);
      return { success: false, path: null, isDuplicate: false, error: msg };
    }

    try {
      const vaultPath = notesPath || await getNotesBasePath();
      const assetsBaseDir = await joinPath(vaultPath, '.nekotick', 'assets');

      // Target Directory based on category
      const targetDirName = category === 'icons' ? 'icons' : 'covers';
      const targetDir = await joinPath(assetsBaseDir, targetDirName);

      if (!await storage.exists(targetDir)) {
        await storage.mkdir(targetDir, true);
      }

      set({ uploadProgress: 20 });

      // Process filename
      // IMPORTANT: check duplicates against assets of SAME category
      // If we use 'icons/' prefix for icons in list, we must match that logic.
      const existingNames = new Set(assetList.map(a => a.filename));

      // If uploading icon, we should check against 'icons/filename'
      // processFilename expects just the name part generally.
      // Let's generate a unique NAME first.

      const filename = processFilename(file.name, existingNames);
      // Note: processFilename might not be category-aware if we pass mixed list.
      // But adding a timestamp usually avoids collision.

      set({ uploadProgress: 50 });

      // Write file
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const filePath = await joinPath(targetDir, filename);

      await writeAssetAtomic(filePath, data);
      set({ uploadProgress: 80 });

      // Determine stored filename (prefix for icons)
      const storedFilename = category === 'icons' ? `icons/${filename}` : filename;

      const newEntry: AssetEntry = {
        filename: storedFilename,
        hash: '',
        size: file.size,
        mimeType: getMimeType(filename),
        uploadedAt: new Date().toISOString(),
      };

      set({
        assetList: [newEntry, ...assetList],
        uploadProgress: 100
      });

      setTimeout(() => set({ uploadProgress: null }), 500);

      return {
        success: true,
        path: storedFilename,
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
      const assetsBaseDir = await joinPath(vaultPath, '.nekotick', 'assets');

      // Determine if it's an icon or cover based on prefix
      let relativePath = filename;
      let targetDir = 'covers'; // Default to legacy covers

      if (filename.startsWith('icons/')) {
        targetDir = 'icons';
        // Remove 'icons/' prefix to get actual filename on disk
        relativePath = filename.replace(/^icons\//, '');
      } else {
        // It's a cover (or legacy asset) in covers/
        targetDir = 'covers';
      }

      // Normalize separators
      const separator = vaultPath.includes('\\') ? '\\' : '/';
      const dirPath = await joinPath(assetsBaseDir, targetDir);
      const normalizedFilename = relativePath.replace(/\//g, separator);
      const filePath = await joinPath(dirPath, normalizedFilename);

      if (await storage.exists(filePath)) {
        await storage.deleteFile(filePath);
      }

      set({ assetList: assetList.filter(a => a.filename !== filename) });
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  },

  cleanupAssetTempFiles: async () => {
    const { notesPath } = get();
    const vaultPath = notesPath || await getNotesBasePath();
    // Clean both directories
    const coversDir = await joinPath(vaultPath, '.nekotick', 'assets', 'covers');
    const iconsDir = await joinPath(vaultPath, '.nekotick', 'assets', 'icons');

    await cleanupTempFiles(coversDir);
    await cleanupTempFiles(iconsDir);
  },

  getAssetList: (category?: 'covers' | 'icons'): AssetEntry[] => {
    const list = get().assetList;
    if (!category) return list;

    if (category === 'icons') {
      return list.filter(a => a.filename.startsWith('icons/'));
    } else {
      // covers are those NOT starting with icons/ (plus builtins if any, usually @...)
      // actually builtins start with @... so they are effectively "covers" usually?
      // Wait, are there builtin icons? EMOJI_MAP handles emojis.
      // Builtin covers are @... 
      // So 'covers' should be everything NOT starting with 'icons/'?
      // Yes, because legacy covers are just 'image.png'.
      return list.filter(a => !a.filename.startsWith('icons/'));
    }
  },

  clearAssetUrlCache: () => {
    clearImageCache();
  },
});
