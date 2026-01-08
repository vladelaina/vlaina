/**
 * Web Storage Adapter
 * 
 * Browser implementation using IndexedDB
 * Simulates a file system structure for web deployment
 */

import type { StorageAdapter, FileInfo, WriteOptions, ListOptions } from './types';

const DB_NAME = 'nekotick-storage';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_DIRS = 'directories';

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
          
          // Files store with path as key
          if (!db.objectStoreNames.contains(STORE_FILES)) {
            db.createObjectStore(STORE_FILES, { keyPath: 'path' });
          }
          
          // Directories store
          if (!db.objectStoreNames.contains(STORE_DIRS)) {
            db.createObjectStore(STORE_DIRS, { keyPath: 'path' });
          }
        };
      });
    }
    
    return this.dbPromise;
  }

  async readFile(path: string): Promise<string> {
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
          // Convert binary to string
          const decoder = new TextDecoder();
          resolve(decoder.decode(file.content as Uint8Array));
        } else {
          resolve(file.content as string);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
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
          resolve(file.content as Uint8Array);
        } else {
          // Convert string to binary
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
        // File doesn't exist, use content as is
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

    let finalContent = content;
    if (options?.append) {
      try {
        const existing = await this.readBinaryFile(normalizedPath);
        const combined = new Uint8Array(existing.length + content.length);
        combined.set(existing);
        combined.set(content, existing.length);
        finalContent = combined;
      } catch {
        // File doesn't exist, use content as is
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
      // Delete all files under this directory
      const files = await this.listDir(normalizedPath, { recursive: true, includeHidden: true });
      for (const file of files) {
        if (file.isFile) {
          await this.deleteFile(file.path);
        }
      }
      
      // Delete all subdirectories
      for (const file of files.reverse()) {
        if (file.isDirectory) {
          await this.deleteDirEntry(file.path);
        }
      }
    }

    // Delete the directory entry itself
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
    
    // Check files
    const fileExists = await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.get(normalizedPath);
      
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
    
    if (fileExists) return true;
    
    // Check directories
    return new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_DIRS, 'readonly');
      const store = tx.objectStore(STORE_DIRS);
      const request = store.get(normalizedPath);
      
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    
    if (recursive) {
      // Create all parent directories
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
    const db = await this.getDB();
    const results: FileInfo[] = [];
    const seenPaths = new Set<string>();

    // Get all files
    const files = await new Promise<StoredFile[]>((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Get all directories
    const dirs = await new Promise<StoredDir[]>((resolve, reject) => {
      const tx = db.transaction(STORE_DIRS, 'readonly');
      const store = tx.objectStore(STORE_DIRS);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const prefix = normalizedPath === '/' ? '/' : `${normalizedPath}/`;

    // Filter files in this directory
    for (const file of files) {
      if (!file.path.startsWith(prefix)) continue;
      
      const relativePath = file.path.slice(prefix.length);
      const parts = relativePath.split('/');
      
      // Direct child or recursive
      if (parts.length === 1 || options?.recursive) {
        const name = parts[0];
        
        // Skip hidden files if not requested
        if (!options?.includeHidden && name.startsWith('.')) continue;
        
        if (!seenPaths.has(file.path)) {
          seenPaths.add(file.path);
          results.push({
            name: file.path.split('/').pop() || '',
            path: file.path,
            isDirectory: false,
            isFile: true,
            size: file.size,
            modifiedAt: file.modifiedAt,
          });
        }
      }
    }

    // Filter directories
    for (const dir of dirs) {
      if (!dir.path.startsWith(prefix)) continue;
      
      const relativePath = dir.path.slice(prefix.length);
      const parts = relativePath.split('/');
      
      if (parts.length === 1 || options?.recursive) {
        const name = parts[0];
        
        if (!options?.includeHidden && name.startsWith('.')) continue;
        
        if (!seenPaths.has(dir.path)) {
          seenPaths.add(dir.path);
          results.push({
            name: dir.path.split('/').pop() || '',
            path: dir.path,
            isDirectory: true,
            isFile: false,
          });
        }
      }
    }

    return results;
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);
    
    // Check if source exists
    const sourceExists = await this.exists(normalizedOld);
    if (!sourceExists) {
      throw new Error(`Path not found: ${oldPath}`);
    }

    // Check if it's a directory
    const stat = await this.stat(normalizedOld);
    if (stat?.isDirectory) {
      // Rename directory: update all files and subdirectories under it
      const db = await this.getDB();
      
      // Get all files under this directory
      const files = await new Promise<StoredFile[]>((resolve, reject) => {
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // Get all directories under this directory
      const dirs = await new Promise<StoredDir[]>((resolve, reject) => {
        const tx = db.transaction(STORE_DIRS, 'readonly');
        const store = tx.objectStore(STORE_DIRS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      // Update all files under this directory
      const prefix = normalizedOld + '/';
      for (const file of files) {
        if (file.path.startsWith(prefix)) {
          const newFilePath = normalizedNew + file.path.slice(normalizedOld.length);
          // Preserve file type (binary vs text)
          if (file.isBinary) {
            await this.writeBinaryFile(newFilePath, file.content as Uint8Array);
          } else {
            await this.writeFile(newFilePath, file.content as string);
          }
          await this.deleteFile(file.path);
        }
      }

      // Update all subdirectories
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
      // Rename file: read, write to new location, delete old
      try {
        const content = await this.readFile(normalizedOld);
        await this.writeFile(normalizedNew, content);
        await this.deleteFile(normalizedOld);
      } catch {
        // Try as binary
        const content = await this.readBinaryFile(normalizedOld);
        await this.writeBinaryFile(normalizedNew, content);
        await this.deleteFile(normalizedOld);
      }
    }
  }

  async copyFile(src: string, dest: string): Promise<void> {
    try {
      const content = await this.readFile(src);
      await this.writeFile(dest, content);
    } catch {
      const content = await this.readBinaryFile(src);
      await this.writeBinaryFile(dest, content);
    }
  }

  async stat(path: string): Promise<FileInfo | null> {
    const normalizedPath = this.normalizePath(path);
    const db = await this.getDB();
    
    // Check files first
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
    
    // Check directories
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
    
    return null;
  }

  async getBasePath(): Promise<string> {
    // Web uses virtual root
    return '/nekotick';
  }

  // Helper methods
  private normalizePath(path: string): string {
    // Normalize to forward slashes and ensure leading slash
    let normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    // Remove double slashes
    normalized = normalized.replace(/\/+/g, '/');
    return normalized;
  }

  private getParentDir(path: string): string | null {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return null;
    parts.pop();
    return '/' + parts.join('/');
  }
}
