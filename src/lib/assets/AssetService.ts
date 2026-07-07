import type { AssetEntry, UploadResult } from './types';
import { listAssets, MAX_ASSET_LIST_DIRECTORY_ENTRIES, MAX_ASSET_METADATA_STAT_CONCURRENCY } from './AssetServiceDirectory';
import { uploadAssetFile } from './AssetServiceUpload';
import type { AssetConfig, AssetContext } from './AssetServiceTypes';

export type { AssetConfig, AssetContext };
export { MAX_ASSET_LIST_DIRECTORY_ENTRIES, MAX_ASSET_METADATA_STAT_CONCURRENCY };

export class AssetService {
  static list(
    context: AssetContext,
    config: AssetConfig
  ): Promise<AssetEntry[]> {
    return listAssets(context, config);
  }

  static upload(
    file: File,
    context: AssetContext,
    config: AssetConfig,
    existingAssets: AssetEntry[],
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    return uploadAssetFile(file, context, config, existingAssets, onProgress);
  }
}
