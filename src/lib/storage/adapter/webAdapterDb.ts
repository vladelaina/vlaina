import {
  WEB_ADAPTER_DB_NAME,
  WEB_ADAPTER_DB_VERSION,
  WEB_ADAPTER_STORE_DIRS,
  WEB_ADAPTER_STORE_FILES,
} from './webAdapterConstants';

export class WebAdapterDatabase {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(WEB_ADAPTER_DB_NAME, WEB_ADAPTER_DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(WEB_ADAPTER_STORE_FILES)) {
            db.createObjectStore(WEB_ADAPTER_STORE_FILES, { keyPath: 'path' });
          }
          if (!db.objectStoreNames.contains(WEB_ADAPTER_STORE_DIRS)) {
            db.createObjectStore(WEB_ADAPTER_STORE_DIRS, { keyPath: 'path' });
          }
        };
      });
    }

    return this.dbPromise;
  }
}
