import { getPaths } from './paths';
import { getStorageAdapter, joinPath } from './adapter';
import type { CustomIcon } from '@/lib/storage/unifiedStorage';

const MAX_GLOBAL_ASSET_BYTES = 10 * 1024 * 1024;
const GLOBAL_ICON_FILENAME_PATTERN = /\.(png|jpg|jpeg|gif|webp|svg)$/i;

function assertGlobalAssetFile(file: File): void {
  if (!GLOBAL_ICON_FILENAME_PATTERN.test(file.name)) {
    throw new Error('Only image files can be saved as custom icons.');
  }

  if (file.size > MAX_GLOBAL_ASSET_BYTES) {
    throw new Error('Custom icon image is too large.');
  }
}

export async function saveGlobalAsset(file: File, folder: 'icons'): Promise<string> {
  assertGlobalAssetFile(file);

  const adapter = getStorageAdapter();
  const { metadata } = await getPaths();
  const assetsDir = await joinPath(metadata, 'assets', folder);
  
  if (!(await adapter.exists(assetsDir))) {
    await adapter.mkdir(assetsDir, true);
  }
  
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${timestamp}_${safeName}`;
  const filePath = await joinPath(assetsDir, filename);
  
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > MAX_GLOBAL_ASSET_BYTES) {
    throw new Error('Custom icon image is too large.');
  }

  await adapter.writeBinaryFile(filePath, new Uint8Array(buffer));
  
  return filePath;
}

export async function scanGlobalIcons(): Promise<CustomIcon[]> {
  const adapter = getStorageAdapter();
  const { metadata } = await getPaths();
  const iconsDir = await joinPath(metadata, 'assets', 'icons');
  
  if (!(await adapter.exists(iconsDir))) {
    return [];
  }
  
  try {
    const files = await adapter.listDir(iconsDir);
    
    const imageFiles = files.filter(f =>
      f.isFile &&
      !f.name.startsWith('.') &&
      GLOBAL_ICON_FILENAME_PATTERN.test(f.name) &&
      (typeof f.size !== 'number' || f.size <= MAX_GLOBAL_ASSET_BYTES)
    );
    
    return imageFiles.map(f => ({
      id: f.path,
      url: `img:${f.path}`,
      name: f.name,
      createdAt: f.modifiedAt || Date.now(),
    }));
  } catch (error) {
    console.error('Failed to scan global icons:', error);
    return [];
  }
}
