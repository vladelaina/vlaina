import type { StorageAdapter, FileInfo, WriteOptions, ListOptions } from './types';

const DB_NAME = 'vlaina-storage';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_DIRS = 'directories';
const PREFIX_RANGE_SUFFIX = '\uffff';
const MARKDOWN_FILE_EXTENSION_PATTERN = /\.(?:md|markdown|mdown|mkd)$/i;
export const MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES = 20_000;
export const MAX_WEB_ADAPTER_LIST_ENTRIES = 20_000;

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

function getListEntryPriority(entry: FileInfo): number {
  if (entry.isDirectory || MARKDOWN_FILE_EXTENSION_PATTERN.test(entry.name)) {
    return 0;
  }
  return 1;
}

function prioritizeListEntries(entries: FileInfo[]): FileInfo[] {
  return entries
    .map((entry, index) => ({ entry, index, priority: getListEntryPriority(entry) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ entry }) => entry);
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

  async readFile(path: string): Promise<string> {
    const file = await this.readStoredFile(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    if (file.isBinary) {
      const decoder = new TextDecoder();
      return decoder.decode(file.content as Uint8Array);
    }

    return file.content as string;
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

  private async writeStoredFile(path: string, file: StoredFile): Promise<void> {
    if (file.isBinary) {
      await this.writeBinaryFile(path, new Uint8Array(file.content as Uint8Array));
    } else {
      await this.writeFile(path, file.content as string);
    }
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
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
          resolve(new Uint8Array(file.content as Uint8Array));
        } else {
          const encoder = new TextEncoder();
          resolve(encoder.encode(file.content as string));
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

    let finalContent = content;
    if (options?.append) {
      try {
        const existing = await this.readFile(normalizedPath);
        finalContent = existing + content;
      } catch {
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
        size: new Blob([finalContent]).size,
        modifiedAt: Date.now(),
        createdAt: Date.now(),
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

    let finalContent = new Uint8Array(content);
    if (options?.append) {
      try {
        const existing = await this.readBinaryFile(normalizedPath);
        const combined = new Uint8Array(existing.length + content.length);
        combined.set(existing);
        combined.set(content, existing.length);
        finalContent = combined;
      } catch {
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
        createdAt: Date.now(),
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
      const files = await this.listDir(normalizedPath, { recursive: true, includeHidden: true });
      for (const file of files) {
        if (file.isFile) {
          await this.deleteFile(file.path);
        }
      }
      
      for (const file of files.reverse()) {
        if (file.isDirectory) {
          await this.deleteDirEntry(file.path);
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
    const files = await this.readStoredFilesByPrefix(prefix);
    const dirs = await this.readStoredDirsByPrefix(prefix);

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
        addEntry({
          name: file.path.split('/').pop() || '',
          path: file.path,
          isDirectory: false,
          isFile: true,
          size: file.size,
          modifiedAt: file.modifiedAt,
        });
        continue;
      }

      if (options?.recursive) {
        addImplicitDirectories(parts.slice(0, -1));
        addEntry({
          name: file.path.split('/').pop() || '',
          path: file.path,
          isDirectory: false,
          isFile: true,
          size: file.size,
          modifiedAt: file.modifiedAt,
        });
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
      const files = await this.readStoredFilesByPrefix(prefix);
      const dirs = await this.readStoredDirsByPrefix(normalizedOld);

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
      return {
        name: normalizedPath.split('/').pop() || '',
        path: normalizedPath,
        isDirectory: false,
        isFile: true,
        size: file.size,
        modifiedAt: file.modifiedAt,
      };
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

  private async readStoredFilesByPrefix(prefix: string): Promise<StoredFile[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      if (typeof store.openCursor !== 'function') {
        const fallbackRequest = store.getAll(this.createPrefixRange(prefix), MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES);
        fallbackRequest.onsuccess = () => {
          const files = (fallbackRequest.result || []) as StoredFile[];
          resolve(files.filter((file) => file.path.startsWith(prefix)));
        };
        fallbackRequest.onerror = () => reject(fallbackRequest.error);
        return;
      }

      const request = store.openCursor(this.createPrefixRange(prefix));
      const files: StoredFile[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(files);
          return;
        }

        const file = cursor.value as StoredFile;
        if (file.path.startsWith(prefix)) {
          files.push(file);
        }
        if (files.length >= MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES) {
          resolve(files);
          return;
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async readStoredDirsByPrefix(prefix: string): Promise<StoredDir[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DIRS, 'readonly');
      const store = tx.objectStore(STORE_DIRS);
      const dirs: StoredDir[] = [];
      const descendantPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      if (typeof store.openCursor !== 'function') {
        const fallbackRequest = store.getAll(this.createPrefixRange(prefix), MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES);
        fallbackRequest.onsuccess = () => {
          const fallbackDirs = (fallbackRequest.result || []) as StoredDir[];
          resolve(fallbackDirs.filter((dir) => dir.path === prefix || dir.path.startsWith(descendantPrefix)));
        };
        fallbackRequest.onerror = () => reject(fallbackRequest.error);
        return;
      }

      const request = store.openCursor(this.createPrefixRange(prefix));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(dirs);
          return;
        }

        const dir = cursor.value as StoredDir;
        if (dir.path === prefix || dir.path.startsWith(descendantPrefix)) {
          dirs.push(dir);
        }
        if (dirs.length >= MAX_WEB_ADAPTER_PREFIX_SCAN_ENTRIES) {
          resolve(dirs);
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
