import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import { getNotesBasePath } from '../storage';
import { AssetEntry, UploadResult } from '@/lib/assets/types';
import { getMimeType, generateFilename } from '@/lib/assets/filenameService';
import { writeAssetAtomic, cleanupTempFiles } from '@/lib/assets/atomicWrite';
import { clearImageCache } from '@/lib/assets/imageLoader';
import { getBuiltinCovers, toBuiltinAssetPath } from '@/lib/assets/builtinCovers';
import { useUIStore } from '@/stores/uiSlice';

const MAX_ASSET_SIZE = 10 * 1024 * 1024;

export interface AssetSlice {
  assetList: AssetEntry[];
  isLoadingAssets: boolean;
  uploadProgress: number | null;

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
    clearImageCache();

    set({ isLoadingAssets: true });
    const storage = getStorageAdapter();

    try {
      const assetsBaseDir = await joinPath(vaultPath, '.nekotick', 'assets');

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

  uploadAsset: async (file: File, category: 'covers' | 'icons' = 'covers', currentNotePath?: string): Promise<UploadResult> => {
    const { notesPath, assetList } = get();
    const storage = getStorageAdapter();

    const { imageStorageMode, imageSubfolderName } = useUIStore.getState();

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
      let targetDir: string;
      let storedPathPrefix = '';

      if (category === 'icons') {
        const assetsBaseDir = await joinPath(vaultPath, '.nekotick', 'assets');
        targetDir = await joinPath(assetsBaseDir, 'icons');
        storedPathPrefix = 'icons/';
      } else if (category === 'covers' && !currentNotePath) {
        const assetsBaseDir = await joinPath(vaultPath, '.nekotick', 'assets');
        targetDir = await joinPath(assetsBaseDir, 'covers');
        storedPathPrefix = '';
      } else {
        switch (imageStorageMode) {
          case 'vault':
          default:
            targetDir = vaultPath;
            storedPathPrefix = '';
            break;

          case 'vaultSubfolder':
            const { imageVaultSubfolderName } = useUIStore.getState();
            const vaultSubfolderName = imageVaultSubfolderName || 'assets';
            targetDir = await joinPath(vaultPath, vaultSubfolderName);
            storedPathPrefix = `${vaultSubfolderName}/`;
            break;

          case 'currentFolder':
            if (currentNotePath) {
              const pathParts = currentNotePath.replace(/\\/g, '/').split('/');
              pathParts.pop();
              targetDir = pathParts.join('/') || vaultPath;
              storedPathPrefix = './';
            } else {
              targetDir = await joinPath(vaultPath, '.nekotick', 'assets', 'covers');
              storedPathPrefix = '';
            }
            break;
          case 'subfolder':
            if (currentNotePath) {
              const pathParts = currentNotePath.replace(/\\/g, '/').split('/');
              pathParts.pop();
              const noteDir = pathParts.join('/') || vaultPath;
              const subfolderName = imageSubfolderName || 'assets';
              targetDir = await joinPath(noteDir, subfolderName);
              storedPathPrefix = `./${subfolderName}/`;
            } else {
              targetDir = await joinPath(vaultPath, '.nekotick', 'assets', 'covers');
              storedPathPrefix = '';
            }
            break;
        }
      }

      if (!await storage.exists(targetDir)) {
        await storage.mkdir(targetDir, true);
      }

      set({ uploadProgress: 20 });

      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const existingAsset = assetList.find(a => a.hash === fileHash);
      if (existingAsset) {
        return {
          success: true,
          path: existingAsset.filename,
          isDuplicate: true,
          existingFilename: existingAsset.filename
        };
      }

      let existingFiles: string[] = [];
      try {
        const files = await storage.listDir(targetDir);
        existingFiles = files.filter(f => f.isFile).map(f => f.name);
      } catch (error) {
        console.warn('Failed to list directory for conflict resolution:', error);
        existingFiles = assetList.map(a => a.filename.split('/').pop() || '');
      }

      const existingNames = new Set(existingFiles);
      let { imageFilenameFormat } = useUIStore.getState();

      const isGenericName = file.name.toLowerCase() === 'image.png';
      const isClipboardTimestamp = Math.abs(Date.now() - file.lastModified) < 2000;

      if (imageFilenameFormat === 'original' && isGenericName && isClipboardTimestamp) {
        imageFilenameFormat = 'timestamp';
      }

      const filename = generateFilename(file.name, imageFilenameFormat, existingNames);

      set({ uploadProgress: 50 });

      const data = new Uint8Array(buffer);
      const filePath = await joinPath(targetDir, filename);

      await writeAssetAtomic(filePath, data);
      set({ uploadProgress: 80 });

      const storedFilename = storedPathPrefix + filename;

      const newEntry: AssetEntry = {
        filename: storedFilename,
        hash: fileHash,
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

      let relativePath = filename;
      let targetDir = 'covers';

      if (filename.startsWith('icons/')) {
        targetDir = 'icons';
        relativePath = filename.replace(/^icons\//, '');
      } else {
        targetDir = 'covers';
      }

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
      return list.filter(a => !a.filename.startsWith('icons/'));
    }
  },

  clearAssetUrlCache: () => {
    clearImageCache();
  },
});
