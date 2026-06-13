import type { StorageAdapter, FileInfo, WriteOptions, ListOptions } from './types';

const DB_NAME = 'vlaina-storage';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_DIRS = 'directories';
const PREFIX_RANGE_SUFFIX = '\uffff';
const MARKDOWN_FILE_EXTENSION_PATTERN = /\.(?:md|markdown|mdown|mkd)$/i;
const UNSAFE_LIST_ENTRY_NAME_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
export const MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES = 20_000;
export const MAX_WEB_ADAPTER_LIST_ENTRIES = 20_000;
export const MAX_WEB_ADAPTER_FILE_BYTES = 64 * 1024 * 1024;
const WEB_ADAPTER_LIST_PRIORITY_BUCKETS = 5;
const LOW_PRIORITY_WEB_ADAPTER_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

interface StoredFile {
  path: string;
  content: string | Uint8Array;
  isBinary: boolean;
  size: number;
  modifiedAt: number;
  createdAt: number;
}

interface StoredDir {
  path: string;
  createdAt: number;
}

interface PrefixScanResult<T> {
  entries: T[];
  truncated: boolean;
}

interface PrefixScanOptions {
  prioritizeForListing?: boolean;
}

function getWebAdapterPathBaseName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? '';
}

function isUnsafeListEntryName(name: string): boolean {
  return (
    !name ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    UNSAFE_LIST_ENTRY_NAME_PATTERN.test(name)
  );
}

function hasUnsafeListPathSegment(path: string): boolean {
  return path
    .split('/')
    .filter(Boolean)
    .some(isUnsafeListEntryName);
}

function getListEntryPriority(entry: FileInfo): number {
  if (isUnsafeListEntryName(entry.name)) {
    return 4;
  }

  if (entry.isFile && MARKDOWN_FILE_EXTENSION_PATTERN.test(entry.name)) {
    return 0;
  }
  if (entry.isDirectory) {
    return LOW_PRIORITY_WEB_ADAPTER_DIRECTORY_NAMES.has(entry.name.toLowerCase()) ? 2 : 1;
  }
  return 3;
}

function prioritizeListEntries(entries: FileInfo[]): FileInfo[] {
  const buckets = Array.from(
    { length: WEB_ADAPTER_LIST_PRIORITY_BUCKETS },
    () => [] as FileInfo[],
  );
  for (const entry of entries) {
    buckets[getListEntryPriority(entry)]?.push(entry);
  }
  return buckets.flat();
}

function getStoredFileListingScanPriority(file: StoredFile): number {
  if (hasUnsafeListPathSegment(file.path)) {
    return 4;
  }
  return MARKDOWN_FILE_EXTENSION_PATTERN.test(getWebAdapterPathBaseName(file.path)) ? 0 : 3;
}

function getStoredDirListingScanPriority(dir: StoredDir): number {
  const name = getWebAdapterPathBaseName(dir.path);
  if (hasUnsafeListPathSegment(dir.path)) {
    return 4;
  }
  return LOW_PRIORITY_WEB_ADAPTER_DIRECTORY_NAMES.has(name.toLowerCase()) ? 2 : 1;
}

function addPrioritizedPrefixEntry<T>(
  buckets: T[][],
  entry: T,
  priority: number,
  limit: number,
  selectedCount: number,
): number {
  const bucketIndex = Math.max(0, Math.min(buckets.length - 1, priority));
  buckets[bucketIndex].push(entry);
  let nextCount = selectedCount + 1;
  for (let index = buckets.length - 1; nextCount > limit && index >= 0; index -= 1) {
    const bucket = buckets[index];
    while (nextCount > limit && bucket.length > 0) {
      bucket.pop();
      nextCount -= 1;
    }
  }
  return nextCount;
}

function flattenPrioritizedPrefixEntries<T>(buckets: T[][]): T[] {
  return buckets.flat();
}

function normalizeReadByteLimit(maxBytes: number | undefined, path: string): number | null {
  if (maxBytes === undefined) {
    return null;
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error(`Invalid binary read limit for ${path}`);
  }
  return maxBytes;
}

function getTextByteLength(content: string): number {
  return new Blob([content]).size;
}

function assertWritableWebByteLength(byteLength: number, path: string): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_WEB_ADAPTER_FILE_BYTES) {
    throw new Error(`Web content is too large to write: ${path}`);
  }
}

function getStoredFileByteLength(file: StoredFile): number {
  if (Number.isSafeInteger(file.size) && file.size >= 0) {
    return file.size;
  }

  if (file.isBinary) {
    return new Uint8Array(file.content as Uint8Array).byteLength;
  }

  return getTextByteLength(file.content as string);
}

function getStoredFileModifiedAt(file: StoredFile): number | undefined {
  return Number.isFinite(file.modifiedAt) ? file.modifiedAt : undefined;
}

function getStoredFileCreatedAt(file: StoredFile | null | undefined): number | undefined {
  return file && Number.isFinite(file.createdAt) ? file.createdAt : undefined;
}

function createStoredFileInfo(file: StoredFile, path = file.path): FileInfo {
  return {
    name: path.split('/').pop() || '',
    path,
    isDirectory: false,
    isFile: true,
    size: getStoredFileByteLength(file),
    createdAt: getStoredFileCreatedAt(file),
    modifiedAt: getStoredFileModifiedAt(file),
  };
}

export class WebAdapter implements StorageAdapter {
  readonly platform = 'web' as const;
  
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains(STORE_FILES)) {
            db.createObjectStore(STORE_FILES, { keyPath: 'path' });
          }
          
          if (!db.objectStoreNames.contains(STORE_DIRS)) {
            db.createObjectStore(STORE_DIRS, { keyPath: 'path' });
          }
        };
      });
    }
    
    return this.dbPromise;
  }

  async readFile(path: string, maxBytes?: number): Promise<string> {
    const readLimit = normalizeReadByteLimit(maxBytes, path);
    const file = await this.readStoredFile(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    if (file.isBinary) {
      const bytes = new Uint8Array(file.content as Uint8Array);
      if (readLimit !== null && bytes.byteLength > readLimit) {
        throw new Error(`File is too large to read: ${path}`);
      }
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    }

    const content = file.content as string;
    if (readLimit !== null && new TextEncoder().encode(content).byteLength > readLimit) {
      throw new Error(`File is too large to read: ${path}`);
    }
    return content;
  }

  private async readStoredFile(path: string): Promise<StoredFile | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.get(this.normalizePath(path));
      request.onsuccess = () => resolve(request.result as StoredFile | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  private decodeStoredFileAsText(file: StoredFile): string {
    if (!file.isBinary) {
      return file.content as string;
    }

    return new TextDecoder().decode(new Uint8Array(file.content as Uint8Array));
  }

  private encodeStoredFileAsBytes(file: StoredFile): Uint8Array {
    if (file.isBinary) {
      return new Uint8Array(file.content as Uint8Array);
    }

    return new TextEncoder().encode(file.content as string);
  }

  private async writeStoredFile(path: string, file: StoredFile): Promise<void> {
    if (file.isBinary) {
      await this.writeBinaryFile(path, new Uint8Array(file.content as Uint8Array));
    } else {
      await this.writeFile(path, file.content as string);
    }
  }

  async readBinaryFile(path: string, maxBytes?: number): Promise<Uint8Array> {
    const readLimit = normalizeReadByteLimit(maxBytes, path);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.get(this.normalizePath(path));

      request.onsuccess = () => {
        const file = request.result as StoredFile | undefined;
        if (!file) {
          reject(new Error(`File not found: ${path}`));
          return;
        }
        if (file.isBinary) {
          const bytes = new Uint8Array(file.content as Uint8Array);
          if (readLimit !== null && bytes.byteLength > readLimit) {
            reject(new Error(`File is too large to read: ${path}`));
            return;
          }
          resolve(bytes);
        } else {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(file.content as string);
          if (readLimit !== null && bytes.byteLength > readLimit) {
            reject(new Error(`File is too large to read: ${path}`));
            return;
          }
          resolve(bytes);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async writeFile(path: string, content: string, options?: WriteOptions): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    
    if (options?.recursive) {
      const dir = this.getParentDir(normalizedPath);
      if (dir) {
        await this.mkdir(dir, true);
      }
    }

    const incomingByteLength = getTextByteLength(content);
    assertWritableWebByteLength(incomingByteLength, normalizedPath);

    const existingFile = await this.readStoredFile(normalizedPath);
    let finalContent = content;
    let finalByteLength = incomingByteLength;
    if (options?.append) {
      if (existingFile) {
        assertWritableWebByteLength(
          getStoredFileByteLength(existingFile) + incomingByteLength,
          normalizedPath,
        );
        const existing = this.decodeStoredFileAsText(existingFile);
        finalContent = existing + content;
        finalByteLength = getTextByteLength(finalContent);
        assertWritableWebByteLength(finalByteLength, normalizedPath);
      }
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      
      const file: StoredFile = {
        path: normalizedPath,
        content: finalContent,
        isBinary: false,
        size: finalByteLength,
        modifiedAt: Date.now(),
        createdAt: getStoredFileCreatedAt(existingFile) ?? Date.now(),
      };
      
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async writeBinaryFile(path: string, content: Uint8Array, options?: WriteOptions): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    
    if (options?.recursive) {
      const dir = this.getParentDir(normalizedPath);
      if (dir) {
        await this.mkdir(dir, true);
      }
    }

    const incomingContent = new Uint8Array(content);
    assertWritableWebByteLength(incomingContent.byteLength, normalizedPath);

    const existingFile = await this.readStoredFile(normalizedPath);
    let finalContent = incomingContent;
    if (options?.append) {
      if (existingFile) {
        assertWritableWebByteLength(
          getStoredFileByteLength(existingFile) + incomingContent.byteLength,
          normalizedPath,
        );
        const existing = this.encodeStoredFileAsBytes(existingFile);
        const finalByteLength = existing.byteLength + incomingContent.byteLength;
        assertWritableWebByteLength(finalByteLength, normalizedPath);
        const combined = new Uint8Array(finalByteLength);
        combined.set(existing);
        combined.set(incomingContent, existing.byteLength);
        finalContent = combined;
      }
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      
      const file: StoredFile = {
        path: normalizedPath,
        content: finalContent,
        isBinary: true,
        size: finalContent.length,
        modifiedAt: Date.now(),
        createdAt: getStoredFileCreatedAt(existingFile) ?? Date.now(),
      };
      
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(path: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      const request = store.delete(this.normalizePath(path));
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDir(path: string, recursive = false): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    if (recursive) {
      const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;
      const fileScan = await this.readStoredFilesByPrefix(prefix);
      const dirScan = await this.readStoredDirsByPrefix(normalizedPath);
      this.assertCompletePrefixScan(fileScan, dirScan, 'delete');

      for (const file of fileScan.entries) {
        if (file.path.startsWith(prefix)) {
          await this.deleteFile(file.path);
        }
      }

      for (const dir of dirScan.entries.slice().reverse()) {
        if (dir.path !== normalizedPath && dir.path.startsWith(prefix)) {
          await this.deleteDirEntry(dir.path);
        }
      }
    } else {
      const entries = await this.listDir(normalizedPath, { includeHidden: true });
      if (entries.length > 0) {
        throw new Error(`Directory not empty: ${path}`);
      }
    }

    await this.deleteDirEntry(normalizedPath);
  }

  private async deleteDirEntry(path: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DIRS, 'readwrite');
      const store = tx.objectStore(STORE_DIRS);
      const request = store.delete(path);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    const db = await this.getDB();
    
    const fileExists = await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.get(normalizedPath);
      
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
    
    if (fileExists) return true;
    
    const dirExists = await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_DIRS, 'readonly');
      const store = tx.objectStore(STORE_DIRS);
      const request = store.get(normalizedPath);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });

    if (dirExists) return true;

    if (await this.hasStoredChildPath(normalizedPath)) {
      return true;
    }

    return false;
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    
    if (recursive) {
      const parts = normalizedPath.split('/').filter(Boolean);
      let currentPath = '';
      
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
        await this.createDirEntry(currentPath);
      }
    } else {
      await this.createDirEntry(normalizedPath);
    }
  }

  private async createDirEntry(path: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DIRS, 'readwrite');
      const store = tx.objectStore(STORE_DIRS);
      
      const dir: StoredDir = {
        path,
        createdAt: Date.now(),
      };
      
      const request = store.put(dir);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async listDir(path: string, options?: ListOptions): Promise<FileInfo[]> {
    const normalizedPath = this.normalizePath(path);
    const results: FileInfo[] = [];
    const seenPaths = new Set<string>();

    const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;
    const fileScan = await this.readStoredFilesByPrefix(prefix, { prioritizeForListing: true });
    const dirScan = await this.readStoredDirsByPrefix(prefix, { prioritizeForListing: true });
    const files = fileScan.entries;
    const dirs = dirScan.entries;

    const addEntry = (entry: FileInfo) => {
      if (seenPaths.has(entry.path)) return;
      seenPaths.add(entry.path);
      results.push(entry);
    };

    const isHiddenPath = (parts: string[]) => !options?.includeHidden && parts.some((part) => part.startsWith('.'));

    const addImplicitDirectories = (parts: string[]) => {
      let currentPath = normalizedPath === '/' ? '' : normalizedPath;
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
        addEntry({
          name: part,
          path: currentPath,
          isDirectory: true,
          isFile: false,
        });
      }
    };

    for (const file of files) {
      if (!file.path.startsWith(prefix)) continue;

      const relativePath = file.path.slice(prefix.length);
      const parts = relativePath.split('/');

      if (isHiddenPath(parts)) continue;

      if (parts.length === 1) {
        addEntry(createStoredFileInfo(file));
        continue;
      }

      if (options?.recursive) {
        addImplicitDirectories(parts.slice(0, -1));
        addEntry(createStoredFileInfo(file));
      } else {
        addEntry({
          name: parts[0],
          path: normalizedPath === '/' ? `/${parts[0]}` : `${normalizedPath}/${parts[0]}`,
          isDirectory: true,
          isFile: false,
        });
      }
    }

    for (const dir of dirs) {
      if (!dir.path.startsWith(prefix)) continue;

      const relativePath = dir.path.slice(prefix.length);
      const parts = relativePath.split('/');

      if (isHiddenPath(parts)) continue;

      if (parts.length === 1) {
        addEntry({
          name: dir.path.split('/').pop() || '',
          path: dir.path,
          isDirectory: true,
          isFile: false,
        });
        continue;
      }

      if (options?.recursive) {
        addImplicitDirectories(parts);
      } else {
        addEntry({
          name: parts[0],
          path: normalizedPath === '/' ? `/${parts[0]}` : `${normalizedPath}/${parts[0]}`,
          isDirectory: true,
          isFile: false,
        });
      }
    }

    if (results.length <= MAX_WEB_ADAPTER_LIST_ENTRIES) {
      return results;
    }

    return prioritizeListEntries(results).slice(0, MAX_WEB_ADAPTER_LIST_ENTRIES);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);
    if (normalizedOld === normalizedNew) {
      return;
    }

    const sourceExists = await this.exists(normalizedOld);
    if (!sourceExists) {
      throw new Error(`Path not found: ${oldPath}`);
    }

    const stat = await this.stat(normalizedOld);
    if (stat?.isDirectory) {
      if (normalizedNew.startsWith(`${normalizedOld}/`)) {
        throw new Error(`Cannot move a directory into itself: ${oldPath}`);
      }

      const prefix = normalizedOld + '/';
      const fileScan = await this.readStoredFilesByPrefix(prefix);
      const dirScan = await this.readStoredDirsByPrefix(normalizedOld);
      this.assertCompletePrefixScan(fileScan, dirScan, 'move');
      const files = fileScan.entries;
      const dirs = dirScan.entries;

      for (const file of files) {
        if (file.path.startsWith(prefix)) {
          const newFilePath = normalizedNew + file.path.slice(normalizedOld.length);
          if (file.isBinary) {
            await this.writeBinaryFile(newFilePath, new Uint8Array(file.content as Uint8Array));
          } else {
            await this.writeFile(newFilePath, file.content as string);
          }
          await this.deleteFile(file.path);
        }
      }

      for (const dir of dirs) {
        if (dir.path === normalizedOld || dir.path.startsWith(prefix)) {
          const newDirPath = dir.path === normalizedOld 
            ? normalizedNew 
            : normalizedNew + dir.path.slice(normalizedOld.length);
          await this.createDirEntry(newDirPath);
          await this.deleteDirEntry(dir.path);
        }
      }
    } else {
      const file = await this.readStoredFile(normalizedOld);
      if (!file) {
        throw new Error(`File not found: ${oldPath}`);
      }
      await this.writeStoredFile(normalizedNew, file);
      await this.deleteFile(normalizedOld);
    }
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const file = await this.readStoredFile(src);
    if (!file) {
      throw new Error(`File not found: ${src}`);
    }
    await this.writeStoredFile(dest, file);
  }

  async stat(path: string): Promise<FileInfo | null> {
    const normalizedPath = this.normalizePath(path);
    const db = await this.getDB();
    
    const file = await new Promise<StoredFile | undefined>((resolve) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.get(normalizedPath);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });

    if (file) {
      return createStoredFileInfo(file, normalizedPath);
    }
    
    const dir = await new Promise<StoredDir | undefined>((resolve) => {
      const tx = db.transaction(STORE_DIRS, 'readonly');
      const store = tx.objectStore(STORE_DIRS);
      const request = store.get(normalizedPath);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
    
    if (dir) {
      return {
        name: normalizedPath.split('/').pop() || '',
        path: normalizedPath,
        isDirectory: true,
        isFile: false,
      };
    }

    if (await this.hasStoredChildPath(normalizedPath)) {
      return {
        name: normalizedPath.split('/').pop() || '',
        path: normalizedPath,
        isDirectory: true,
        isFile: false,
      };
    }

    return null;
  }

  async getBasePath(): Promise<string> {
    return '/vlaina';
  }

  private normalizePath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const parts: string[] = [];

    for (const part of normalized.split('/')) {
      if (!part || part === '.') {
        continue;
      }
      if (part === '..') {
        if (parts.length > 0) {
          parts.pop();
        } else if (!normalized.startsWith('/')) {
          throw new Error(`Path escapes storage root: ${path}`);
        }
        continue;
      }
      parts.push(part);
    }

    return parts.length > 0 ? `/${parts.join('/')}` : '/';
  }

  private getParentDir(path: string): string | null {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return null;
    parts.pop();
    return '/' + parts.join('/');
  }

  private async hasStoredChildPath(normalizedPath: string): Promise<boolean> {
    const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;

    const hasFileChild = await this.hasStoredEntryWithPrefix(STORE_FILES, prefix);

    if (hasFileChild) return true;

    return this.hasStoredEntryWithPrefix(STORE_DIRS, prefix);
  }

  private createPrefixRange(prefix: string): IDBKeyRange {
    return IDBKeyRange.bound(prefix, `${prefix}${PREFIX_RANGE_SUFFIX}`);
  }

  private assertCompletePrefixScan(
    fileScan: PrefixScanResult<StoredFile>,
    dirScan: PrefixScanResult<StoredDir>,
    operation: 'delete' | 'move',
  ): void {
    if (!fileScan.truncated && !dirScan.truncated) {
      return;
    }

    throw new Error(`Directory is too large to ${operation} safely.`);
  }

  private async readStoredFilesByPrefix(
    prefix: string,
    options: PrefixScanOptions = {},
  ): Promise<PrefixScanResult<StoredFile>> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      if (typeof store.openCursor !== 'function') {
        const fallbackRequest = options.prioritizeForListing
          ? store.getAll(this.createPrefixRange(prefix))
          : store.getAll(this.createPrefixRange(prefix), MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES);
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
        return;
      }

      const request = store.openCursor(this.createPrefixRange(prefix));
      const files: StoredFile[] = [];
      const buckets: StoredFile[][] = [[], [], [], [], []];
      let selectedCount = 0;
      let scannedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve({
            entries: options.prioritizeForListing ? flattenPrioritizedPrefixEntries(buckets) : files,
            truncated: options.prioritizeForListing
              ? scannedCount > MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES
              : false,
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

  private async readStoredDirsByPrefix(
    prefix: string,
    options: PrefixScanOptions = {},
  ): Promise<PrefixScanResult<StoredDir>> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DIRS, 'readonly');
      const store = tx.objectStore(STORE_DIRS);
      const dirs: StoredDir[] = [];
      const descendantPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      if (typeof store.openCursor !== 'function') {
        const fallbackRequest = options.prioritizeForListing
          ? store.getAll(this.createPrefixRange(prefix))
          : store.getAll(this.createPrefixRange(prefix), MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES);
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
        return;
      }

      const request = store.openCursor(this.createPrefixRange(prefix));
      const buckets: StoredDir[][] = [[], [], [], [], []];
      let selectedCount = 0;
      let scannedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve({
            entries: options.prioritizeForListing ? flattenPrioritizedPrefixEntries(buckets) : dirs,
            truncated: options.prioritizeForListing
              ? scannedCount > MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES
              : false,
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

  private async hasStoredEntryWithPrefix(storeName: typeof STORE_FILES | typeof STORE_DIRS, prefix: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll(this.createPrefixRange(prefix), 1);

      request.onsuccess = () => {
        const entries = (request.result || []) as Array<{ path: string }>;
        resolve(entries.some((entry) => entry.path.startsWith(prefix)));
      };
      request.onerror = () => resolve(false);
    });
  }
}
