import { getStorageAdapter, joinPath } from './adapter';
import { getStorageBasePath } from './basePath';

export async function getBasePath(): Promise<string> {
  return getStorageBasePath();
}

export async function getPaths() {
  const base = await getBasePath();
  return {
    base,
    metadata: await joinPath(base, '.vlaina'),
    store: await joinPath(base, '.vlaina', 'store'),
    dataJson: await joinPath(base, '.vlaina', 'store', 'data.json'),
    markdown: await joinPath(base, 'vlaina.md'),
  };
}

export async function ensureDirectories(): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const storeDir = await joinPath(base, '.vlaina', 'store');
    
    if (!(await storage.exists(storeDir))) {
      await storage.mkdir(storeDir, true);
    }
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
}
