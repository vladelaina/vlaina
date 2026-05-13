import { StateCreator } from 'zustand';
import { NotesStore } from '../types';
import { AssetEntry, UploadResult } from '@/lib/assets/types';
import { AssetService } from '@/lib/assets/AssetService';
import { getBuiltinCoverAssetEntries } from '@/lib/assets/builtinCovers';
import { useUIStore } from '@/stores/uiSlice';
import { clearImageCache } from '@/lib/assets';
import { resolveEffectiveVaultPath } from '../effectiveVaultPath';

let uploadProgressResetTimer: ReturnType<typeof setTimeout> | null = null;
const loadAssetsInFlight = new Map<string, Promise<void>>();

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

function getDefaultCoverAssets(): AssetEntry[] {
  return getBuiltinCoverAssetEntries();
}

function combineAndSortAssets(userAssets: AssetEntry[]): AssetEntry[] {
  const assets = [...userAssets, ...getDefaultCoverAssets()];

  assets.sort((a, b) => {
    const aIsBuiltIn = a.filename.startsWith('@');
    const bIsBuiltIn = b.filename.startsWith('@');
    if (aIsBuiltIn !== bIsBuiltIn) return aIsBuiltIn ? 1 : -1;
    return b.filename.localeCompare(a.filename);
  });

  return assets;
}

function getAssetConfig() {
  const uiState = useUIStore.getState();
  return {
    storageMode: uiState.imageStorageMode,
    subfolderName: uiState.imageSubfolderName,
    imageVaultSubfolderName: uiState.imageVaultSubfolderName,
    filenameFormat: uiState.imageFilenameFormat,
  };
}

function getLoadAssetsKey(vaultPath: string, currentNotePath: string | undefined, config: ReturnType<typeof getAssetConfig>) {
  return JSON.stringify({
    vaultPath,
    currentNotePath: currentNotePath ?? '',
    storageMode: config.storageMode,
    subfolderName: config.subfolderName,
    imageVaultSubfolderName: config.imageVaultSubfolderName,
    filenameFormat: config.filenameFormat,
  });
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
  assetList: getDefaultCoverAssets(),
  isLoadingAssets: false,
  uploadProgress: null,

  loadAssets: async (vaultPath: string) => {
    const currentNotePath = get().currentNote?.path;
    const config = getAssetConfig();
    const loadKey = getLoadAssetsKey(vaultPath, currentNotePath, config);
    const existingLoad = loadAssetsInFlight.get(loadKey);
    if (existingLoad) {
      await existingLoad;
      return;
    }

    const loadPromise = (async () => {
      set({
        isLoadingAssets: true,
        assetList: getDefaultCoverAssets(),
      });

      try {
      const context = {
        vaultPath,
        currentNotePath,
      };

      let assets: AssetEntry[] = [];
      try {
        assets = await AssetService.list(context, config);
      } catch (error) {
        console.error('Failed to load user assets:', error);
      }

      assets = combineAndSortAssets(assets);

      set({ assetList: assets, isLoadingAssets: false });
    } catch (error) {
      console.error('Failed to load assets:', error);
      set({ assetList: [], isLoadingAssets: false });
    }
    })();

    loadAssetsInFlight.set(loadKey, loadPromise);
    try {
      await loadPromise;
    } finally {
      if (loadAssetsInFlight.get(loadKey) === loadPromise) {
        loadAssetsInFlight.delete(loadKey);
      }
    }
  },

  uploadAsset: async (file: File, currentNotePath?: string): Promise<UploadResult> => {
    const { notesPath, assetList } = get();
    const config = getAssetConfig();

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

      if (result.success && result.entry) {
        set((state) => ({
          assetList: [
            result.entry!,
            ...state.assetList.filter((asset) => asset.filename !== result.entry!.filename),
          ],
        }));
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
