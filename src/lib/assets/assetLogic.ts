import { AssetEntry } from './types';

export function sortAssetsByDate(assets: AssetEntry[]): AssetEntry[] {
  return [...assets].sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}
