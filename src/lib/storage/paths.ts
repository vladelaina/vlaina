import { getStorageAdapter, joinPath } from './adapter';

let basePath: string | null = null;

export async function getBasePath(): Promise<string> {
  if (basePath === null) {
    const storage = getStorageAdapter();
    const appData = await storage.getBasePath();
    basePath =
      appData.endsWith('\\') || appData.endsWith('/') ? appData.slice(0, -1) : appData;
  }
  return basePath;
}

export async function getPaths() {
  const base = await getBasePath();
  return {
    base,
    metadata: await joinPath(base, '.nekotick'),
    store: await joinPath(base, '.nekotick', 'store'),
    dataJson: await joinPath(base, '.nekotick', 'store', 'data.json'),
    markdown: await joinPath(base, 'nekotick.md'),
  };
}

export async function ensureDirectories(): Promise<void> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const storeDir = await joinPath(base, '.nekotick', 'store');
    
    if (!(await storage.exists(storeDir))) {
      await storage.mkdir(storeDir, true);
    }
  } catch (error) {
    console.error('Failed to create directories:', error);
  }
}
