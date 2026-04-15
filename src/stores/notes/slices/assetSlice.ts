import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import { getNotesBasePath } from '../storage';
import { AssetEntry, UploadResult } from '@/lib/assets/types';
import { AssetService } from '@/lib/assets/AssetService';
import { getBuiltinCovers, toBuiltinAssetPath } from '@/lib/assets/builtinCovers';
import { useUIStore } from '@/stores/uiSlice';
import { getMimeType } from '@/lib/assets/core/naming';
import { clearImageCache, cleanupTempFiles } from '@/lib/assets'; // Re-export from index



export interface AssetSlice {
  assetList: AssetEntry[];
  isLoadingAssets: boolean;
  uploadProgress: number | null;

  loadAssets: (vaultPath: string) => Promise<void>;
  uploadAsset: (file: File, category?: 'covers' | 'icons' | 'content', currentNotePath?: string) => Promise<UploadResult>;
  deleteAsset: (filename: string) => Promise<void>;
  cleanupAssetTempFiles: () => Promise<void>;
  getAssetList: (category?: 'covers' | 'icons' | 'content') => AssetEntry[];
  clearAssetUrlCache: () => void;
}

export const createAssetSlice: StateCreator<NotesStore, [], [], AssetSlice> = (set, get) => ({
  assetList: [],
  isLoadingAssets: false,
  uploadProgress: null,

  loadAssets: async (vaultPath: string) => {
    clearImageCache();

    set({ isLoadingAssets: true });
    const storage = getStorageAdapter();

    try {
      const assetsBaseDir = await joinPath(vaultPath, '.vlaina', 'assets');

      const coversDir = await joinPath(assetsBaseDir, 'covers');
      const iconsDir = await joinPath(assetsBaseDir, 'icons');

      if (!await storage.exists(coversDir)) await storage.mkdir(coversDir, true);
      if (!await storage.exists(iconsDir)) await storage.mkdir(iconsDir, true);

      const assets: AssetEntry[] = [];

      async function scanCategory(dirPath: string, category: 'covers' | 'icons') {
        if (!await storage.exists(dirPath)) return;

        const entries = await storage.listDir(dirPath);
        for (const entry of entries) {
          if (entry.name.endsWith('.tmp')) continue;

          if (entry.isDirectory) {
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

      await scanCategory(coversDir, 'covers');
      await scanCategory(iconsDir, 'icons');

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

      assets.sort((a, b) => {
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

  uploadAsset: async (file: File, category: 'covers' | 'icons' | 'content' = 'content', currentNotePath?: string): Promise<UploadResult> => {
    const { notesPath, assetList } = get();
    const uiState = useUIStore.getState();

    const config = {
      storageMode: uiState.imageStorageMode,
      subfolderName: uiState.imageSubfolderName,
      imageVaultSubfolderName: uiState.imageVaultSubfolderName,
      filenameFormat: uiState.imageFilenameFormat,
    };

    const vaultPath = notesPath || await getNotesBasePath();
    const context = {
      vaultPath,
      currentNotePath,
      category
    };

    set({ uploadProgress: 0 });

    try {
      const result = await AssetService.upload(
        file,
        context,
        config,
        assetList,
        (progress) => set({ uploadProgress: progress })
      );

      if (result.success && result.entry) {
        if (!result.isDuplicate) {
          set(state => ({
            assetList: [result.entry!, ...state.assetList],
            uploadProgress: 100
          }));
        }
      }

      setTimeout(() => set({ uploadProgress: null }), 500);
      return result;

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
      const assetsBaseDir = await joinPath(vaultPath, '.vlaina', 'assets');

      let relativePath = filename;
      let targetDir = 'covers';

      if (filename.startsWith('icons/')) {
        targetDir = 'icons';
        relativePath = filename.replace(/^icons\//, '');
      } else {
        targetDir = 'covers';
      }

      const dirPath = await joinPath(assetsBaseDir, targetDir);
      const filePath = await joinPath(dirPath, relativePath);

      if (await storage.exists(filePath)) {
        await storage.deleteFile(filePath);
      }

      set({ assetList: assetList.filter(a => a.filename !== filename) });
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  },

  cleanupAssetTempFiles: async () => {
    try {
      const { notesPath } = get();
      const vaultPath = notesPath || await getNotesBasePath();

      const coversDir = await joinPath(vaultPath, '.vlaina', 'assets', 'covers');
      const iconsDir = await joinPath(vaultPath, '.vlaina', 'assets', 'icons');

      await cleanupTempFiles(coversDir);
      await cleanupTempFiles(iconsDir);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Failed to cleanup asset temp files:', error);
    }
  },

  getAssetList: (category?: 'covers' | 'icons' | 'content'): AssetEntry[] => {
    const list = get().assetList;
    if (!category) {
      const builtinCoverAssets = getBuiltinCovers().map((cover) => ({
        filename: toBuiltinAssetPath(cover),
        hash: '',
        size: 0,
        mimeType: 'image/webp',
        uploadedAt: '',
      }));
      const existing = new Set(list.map((asset) => asset.filename));
      return [...list, ...builtinCoverAssets.filter((asset) => !existing.has(asset.filename))];
    }

    if (category === 'icons') {
      return list.filter(a => a.filename.startsWith('icons/'));
    } else if (category === 'covers') {
      const coverAssets = list.filter(a => !a.filename.startsWith('icons/'));
      const existing = new Set(coverAssets.map((asset) => asset.filename));
      const builtinCoverAssets = getBuiltinCovers().map((cover) => ({
        filename: toBuiltinAssetPath(cover),
        hash: '',
        size: 0,
        mimeType: 'image/webp',
        uploadedAt: '',
      }));
      return [...coverAssets, ...builtinCoverAssets.filter((asset) => !existing.has(asset.filename))];
    } else {
      // content
      return list.filter(a => !a.filename.startsWith('icons/'));
    }
  },

  clearAssetUrlCache: () => {
    clearImageCache();
  },
});
