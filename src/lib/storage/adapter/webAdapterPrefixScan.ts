import {
  MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
  WEB_ADAPTER_PREFIX_RANGE_SUFFIX,
  WEB_ADAPTER_STORE_DIRS,
  WEB_ADAPTER_STORE_FILES,
} from './webAdapterConstants';
import {
  addPrioritizedPrefixEntry,
  flattenPrioritizedPrefixEntries,
  getStoredDirListingScanPriority,
  getStoredFileListingScanPriority,
} from './webAdapterListing';
import type { PrefixScanOptions, PrefixScanResult, StoredDir, StoredFile } from './webAdapterTypes';

export function createWebAdapterPrefixRange(prefix: string): IDBKeyRange {
  return IDBKeyRange.bound(prefix, `${prefix}${WEB_ADAPTER_PREFIX_RANGE_SUFFIX}`);
}

export function assertCompletePrefixScan(
  fileScan: PrefixScanResult<StoredFile>,
  dirScan: PrefixScanResult<StoredDir>,
  operation: 'delete' | 'move',
): void {
  if (!fileScan.truncated && !dirScan.truncated) {
    return;
  }

  throw new Error(`Directory is too large to ${operation} safely.`);
}

export async function readStoredFilesByPrefix(
  db: IDBDatabase,
  prefix: string,
  options: PrefixScanOptions = {},
): Promise<PrefixScanResult<StoredFile>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_ADAPTER_STORE_FILES, 'readonly');
    const store = tx.objectStore(WEB_ADAPTER_STORE_FILES);
    if (typeof store.openCursor !== 'function') {
      readStoredFilesByPrefixFallback(store, prefix, options, resolve, reject);
      return;
    }

    const request = store.openCursor(createWebAdapterPrefixRange(prefix));
    const files: StoredFile[] = [];
    const buckets: StoredFile[][] = [[], [], [], [], []];
    let selectedCount = 0;
    let scannedCount = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve({
          entries: options.prioritizeForListing ? flattenPrioritizedPrefixEntries(buckets) : files,
          truncated: options.prioritizeForListing ? scannedCount > MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES : false,
        });
        return;
      }

      const file = cursor.value as StoredFile;
      if (file.path.startsWith(prefix)) {
        if (options.prioritizeForListing) {
          scannedCount += 1;
          selectedCount = addPrioritizedPrefixEntry(
            buckets,
            file,
            getStoredFileListingScanPriority(file),
            MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
            selectedCount,
          );
        } else {
          files.push(file);
        }
      }
      if (!options.prioritizeForListing && files.length >= MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES) {
        resolve({ entries: files, truncated: true });
        return;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function readStoredFilesByPrefixFallback(
  store: IDBObjectStore,
  prefix: string,
  options: PrefixScanOptions,
  resolve: (result: PrefixScanResult<StoredFile>) => void,
  reject: (error: unknown) => void,
): void {
  const fallbackRequest = options.prioritizeForListing
    ? store.getAll(createWebAdapterPrefixRange(prefix))
    : store.getAll(createWebAdapterPrefixRange(prefix), MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES);
  fallbackRequest.onsuccess = () => {
    const files = (fallbackRequest.result || []) as StoredFile[];
    const entries = files.filter((file) => file.path.startsWith(prefix));
    if (options.prioritizeForListing) {
      const buckets: StoredFile[][] = [[], [], [], [], []];
      let selectedCount = 0;
      for (const file of entries) {
        selectedCount = addPrioritizedPrefixEntry(
          buckets,
          file,
          getStoredFileListingScanPriority(file),
          MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
          selectedCount,
        );
      }
      resolve({
        entries: flattenPrioritizedPrefixEntries(buckets),
        truncated: entries.length > MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
      });
      return;
    }
    resolve({
      entries,
      truncated: files.length >= MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
    });
  };
  fallbackRequest.onerror = () => reject(fallbackRequest.error);
}

export async function readStoredDirsByPrefix(
  db: IDBDatabase,
  prefix: string,
  options: PrefixScanOptions = {},
): Promise<PrefixScanResult<StoredDir>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WEB_ADAPTER_STORE_DIRS, 'readonly');
    const store = tx.objectStore(WEB_ADAPTER_STORE_DIRS);
    const dirs: StoredDir[] = [];
    const descendantPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    if (typeof store.openCursor !== 'function') {
      readStoredDirsByPrefixFallback(store, prefix, descendantPrefix, options, resolve, reject);
      return;
    }

    const request = store.openCursor(createWebAdapterPrefixRange(prefix));
    const buckets: StoredDir[][] = [[], [], [], [], []];
    let selectedCount = 0;
    let scannedCount = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve({
          entries: options.prioritizeForListing ? flattenPrioritizedPrefixEntries(buckets) : dirs,
          truncated: options.prioritizeForListing ? scannedCount > MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES : false,
        });
        return;
      }

      const dir = cursor.value as StoredDir;
      if (dir.path === prefix || dir.path.startsWith(descendantPrefix)) {
        if (options.prioritizeForListing) {
          scannedCount += 1;
          selectedCount = addPrioritizedPrefixEntry(
            buckets,
            dir,
            getStoredDirListingScanPriority(dir),
            MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
            selectedCount,
          );
        } else {
          dirs.push(dir);
        }
      }
      if (!options.prioritizeForListing && dirs.length >= MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES) {
        resolve({ entries: dirs, truncated: true });
        return;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function readStoredDirsByPrefixFallback(
  store: IDBObjectStore,
  prefix: string,
  descendantPrefix: string,
  options: PrefixScanOptions,
  resolve: (result: PrefixScanResult<StoredDir>) => void,
  reject: (error: unknown) => void,
): void {
  const fallbackRequest = options.prioritizeForListing
    ? store.getAll(createWebAdapterPrefixRange(prefix))
    : store.getAll(createWebAdapterPrefixRange(prefix), MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES);
  fallbackRequest.onsuccess = () => {
    const fallbackDirs = (fallbackRequest.result || []) as StoredDir[];
    const entries = fallbackDirs.filter((dir) => dir.path === prefix || dir.path.startsWith(descendantPrefix));
    if (options.prioritizeForListing) {
      const buckets: StoredDir[][] = [[], [], [], [], []];
      let selectedCount = 0;
      for (const dir of entries) {
        selectedCount = addPrioritizedPrefixEntry(
          buckets,
          dir,
          getStoredDirListingScanPriority(dir),
          MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
          selectedCount,
        );
      }
      resolve({
        entries: flattenPrioritizedPrefixEntries(buckets),
        truncated: entries.length > MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
      });
      return;
    }
    resolve({
      entries,
      truncated: fallbackDirs.length >= MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES,
    });
  };
  fallbackRequest.onerror = () => reject(fallbackRequest.error);
}

export async function hasStoredEntryWithPrefix(
  db: IDBDatabase,
  storeName: typeof WEB_ADAPTER_STORE_FILES | typeof WEB_ADAPTER_STORE_DIRS,
  prefix: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll(createWebAdapterPrefixRange(prefix), 1);

    request.onsuccess = () => {
      const entries = (request.result || []) as Array<{ path: string }>;
      resolve(entries.some((entry) => entry.path.startsWith(prefix)));
    };
    request.onerror = () => resolve(false);
  });
}
