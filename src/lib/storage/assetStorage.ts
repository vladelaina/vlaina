import { getPaths } from './paths';
import { getStorageAdapter, joinPath } from './adapter';
import type { CustomIcon } from '@/lib/storage/unifiedStorage';

export async function saveGlobalAsset(file: File, folder: 'icons' | 'covers'): Promise<string> {
  const adapter = getStorageAdapter();
  const { metadata } = await getPaths();
  const assetsDir = await joinPath(metadata, 'assets', folder);
  
  // Ensure directory exists
  if (!(await adapter.exists(assetsDir))) {
    await adapter.mkdir(assetsDir, true);
  }
  
  // Create filename: timestamp_clean-name
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${timestamp}_${safeName}`;
  const filePath = await joinPath(assetsDir, filename);
  
  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();
  
  // Write file
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
    
    // Filter for images
    const imageFiles = files.filter(f => 
      f.isFile && 
      !f.name.startsWith('.') &&
      /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.name)
    );
    
    return imageFiles.map(f => ({
      id: f.path, // Use path as ID
      url: `img:${f.path}`, // Protocol format used by UniversalIcon
      name: f.name,
      createdAt: f.modifiedAt || Date.now(),
    }));
  } catch (error) {
    console.error('Failed to scan global icons:', error);
    return [];
  }
}
