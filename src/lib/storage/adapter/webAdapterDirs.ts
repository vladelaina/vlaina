import {
  WEB_ADAPTER_STORE_DIRS,
} from './webAdapterConstants';
import type { StoredDir } from './webAdapterTypes';

export async function createDirEntry(db: IDBDatabase, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_ADAPTER_STORE_DIRS, 'readwrite');
    const store = tx.objectStore(WEB_ADAPTER_STORE_DIRS);

    const dir: StoredDir = {
      path,
      createdAt: Date.now(),
    };

    const request = store.put(dir);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDirEntry(db: IDBDatabase, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_ADAPTER_STORE_DIRS, 'readwrite');
    const store = tx.objectStore(WEB_ADAPTER_STORE_DIRS);
    const request = store.delete(path);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function readStoredDir(db: IDBDatabase, normalizedPath: string): Promise<StoredDir | undefined> {
  return new Promise((resolve) => {
    const tx = db.transaction(WEB_ADAPTER_STORE_DIRS, 'readonly');
    const store = tx.objectStore(WEB_ADAPTER_STORE_DIRS);
    const request = store.get(normalizedPath);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}
