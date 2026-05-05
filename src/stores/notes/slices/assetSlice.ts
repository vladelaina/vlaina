import { StateCreator } from 'zustand';
import { NotesStore } from '../types';
import { AssetEntry, UploadResult } from '@/lib/assets/types';
import { AssetService } from '@/lib/assets/AssetService';
import { getBuiltinCovers, toBuiltinAssetPath } from '@/lib/assets/builtinCovers';
import { useUIStore } from '@/stores/uiSlice';
import { clearImageCache } from '@/lib/assets';
import { resolveEffectiveVaultPath } from '../effectiveVaultPath';

let uploadProgressResetTimer: ReturnType<typeof setTimeout> | null = null;

function clearUploadProgressResetTimer() {
  if (uploadProgressResetTimer === null) {
    return;
  }

  clearTimeout(uploadProgressResetTimer);
  uploadProgressResetTimer = null;
}

function isActiveUploadVault(state: NotesStore, vaultPath: string) {
  return resolveEffectiveVaultPath({
    notesPath: state.notesPath,
    currentNotePath: state.currentNote?.path,
  }) === vaultPath;
}

export interface AssetSlice {
  assetList: AssetEntry[];
  isLoadingAssets: boolean;
  uploadProgress: number | null;

  loadAssets: (vaultPath: string) => Promise<void>;
  uploadAsset: (file: File, currentNotePath?: string) => Promise<UploadResult>;
  deleteAsset: (filename: string) => Promise<void>;
  cleanupAssetTempFiles: () => Promise<void>;
  getAssetList: (category?: 'builtinCovers') => AssetEntry[];
  clearAssetUrlCache: () => void;
}

export const createAssetSlice: StateCreator<NotesStore, [], [], AssetSlice> = (set, get) => ({
  assetList: [],
  isLoadingAssets: false,
  uploadProgress: null,

  loadAssets: async (vaultPath: string) => {
    clearImageCache();

    set({ isLoadingAssets: true });

    try {
      const assets: AssetEntry[] = [];

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

      if (get().notesPath !== vaultPath) {
        return;
      }

      set({ assetList: assets, isLoadingAssets: false });
    } catch (error) {
      console.error('Failed to load assets:', error);
      if (get().notesPath !== vaultPath) {
        return;
      }
      set({ assetList: [], isLoadingAssets: false });
    }
  },

  uploadAsset: async (file: File, currentNotePath?: string): Promise<UploadResult> => {
    const { notesPath, assetList } = get();
    const uiState = useUIStore.getState();

    const config = {
      storageMode: uiState.imageStorageMode,
      subfolderName: uiState.imageSubfolderName,
      imageVaultSubfolderName: uiState.imageVaultSubfolderName,
      filenameFormat: uiState.imageFilenameFormat,
    };

    const vaultPath = resolveEffectiveVaultPath({ notesPath, currentNotePath });
    if (!vaultPath) {
      return {
        success: false,
        path: null,
        isDuplicate: false,
        error: 'Vault path is unavailable',
      };
    }

    const context = {
      vaultPath,
      currentNotePath,
    };

    clearUploadProgressResetTimer();
    set({ uploadProgress: 0 });

    try {
      const result = await AssetService.upload(
        file,
        context,
        config,
        assetList,
        (progress) => {
          if (isActiveUploadVault(get(), vaultPath)) {
            set({ uploadProgress: progress });
          }
        }
      );

      if (!isActiveUploadVault(get(), vaultPath)) {
        return result;
      }

      uploadProgressResetTimer = setTimeout(() => {
        uploadProgressResetTimer = null;
        if (isActiveUploadVault(get(), vaultPath)) {
          set({ uploadProgress: null });
        }
      }, 500);
      return result;

    } catch (error) {
      clearUploadProgressResetTimer();
      if (isActiveUploadVault(get(), vaultPath)) {
        set({ uploadProgress: null });
      }
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
    void filename;
  },

  cleanupAssetTempFiles: async () => {
    return;
  },

  getAssetList: (category?: 'builtinCovers'): AssetEntry[] => {
    const list = get().assetList;
    if (!category) return list;
    return list;
  },

  clearAssetUrlCache: () => {
    clearImageCache();
    clearUploadProgressResetTimer();
  },
});
