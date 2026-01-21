/**
 * Tauri Storage Adapter
 * 
 * Desktop implementation using @tauri-apps/plugin-fs
 * Provides native file system access on Windows, macOS, and Linux
 */

import {
  readTextFile,
  readFile as readBinary,
  writeTextFile,
  writeFile as writeBinary,
  remove,
  exists as fsExists,
  mkdir as fsMkdir,
  readDir,
  rename as fsRename,
  copyFile as fsCopyFile,
  stat as fsStat,
} from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import type { StorageAdapter, FileInfo, WriteOptions, ListOptions } from './types';

export class TauriAdapter implements StorageAdapter {
  readonly platform = 'tauri' as const;
  
  private basePath: string | null = null;

  async readFile(path: string): Promise<string> {
    return readTextFile(path);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    return readBinary(path);
  }

  async writeFile(path: string, content: string, options?: WriteOptions): Promise<void> {
    if (options?.recursive) {
      const dir = this.getParentDir(path);
      if (dir && !(await this.exists(dir))) {
        await this.mkdir(dir, true);
      }
    }

    if (options?.append) {
      const existing = await this.exists(path) ? await this.readFile(path) : '';
      await writeTextFile(path, existing + content);
    } else {
      // Atomic write: write to temp file then rename
      // Use unique temp path to avoid race conditions
      const tempPath = `${path}.${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;

      try {
        await writeTextFile(tempPath, content);
        await fsRename(tempPath, path);
      } catch (error) {
        // Cleanup temp file on failure
        try { await remove(tempPath); } catch { /* ignore */ }
        throw error;
      }
    }
  }

  async writeBinaryFile(path: string, content: Uint8Array, options?: WriteOptions): Promise<void> {
    if (options?.recursive) {
      const dir = this.getParentDir(path);
      if (dir && !(await this.exists(dir))) {
        await this.mkdir(dir, true);
      }
    }

    if (options?.append) {
      const existing = await this.exists(path) ? await this.readBinaryFile(path) : new Uint8Array(0);
      const combined = new Uint8Array(existing.length + content.length);
      combined.set(existing);
      combined.set(content, existing.length);
      await writeBinary(path, combined);
    } else {
      // Atomic write for binary files
      const tempPath = `${path}.${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
      try {
        await writeBinary(tempPath, content);
        await fsRename(tempPath, path);
      } catch (error) {
        try { await remove(tempPath); } catch { /* ignore */ }
        throw error;
      }
    }
  }

  async deleteFile(path: string): Promise<void> {
    await remove(path);
  }

  async deleteDir(path: string, recursive = false): Promise<void> {
    await remove(path, { recursive });
  }

  async exists(path: string): Promise<boolean> {
    return fsExists(path);
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    await fsMkdir(path, { recursive });
  }

  async listDir(path: string, options?: ListOptions): Promise<FileInfo[]> {
    const entries = await readDir(path);
    const results: FileInfo[] = [];

    for (const entry of entries) {
      // Skip hidden files if not requested
      if (!options?.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = this.joinPath(path, entry.name);
      const info: FileInfo = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
      };

      results.push(info);

      // Recursive listing
      if (options?.recursive && entry.isDirectory) {
        const subEntries = await this.listDir(fullPath, options);
        results.push(...subEntries);
      }
    }

    return results;
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await fsRename(oldPath, newPath);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fsCopyFile(src, dest);
  }

  async stat(path: string): Promise<FileInfo | null> {
    try {
      const info = await fsStat(path);
      const name = path.split(/[/\\]/).pop() || '';
      return {
        name,
        path,
        isDirectory: info.isDirectory,
        isFile: info.isFile,
        size: info.size,
        modifiedAt: info.mtime ? new Date(info.mtime).getTime() : undefined,
      };
    } catch {
      return null;
    }
  }

  async getBasePath(): Promise<string> {
    if (this.basePath === null) {
      const appData = await appDataDir();
      // Remove trailing slash
      this.basePath = appData.endsWith('\\') || appData.endsWith('/')
        ? appData.slice(0, -1)
        : appData;
    }
    return this.basePath;
  }

  // Helper methods
  private getParentDir(path: string): string | null {
    // Detect separator: Windows uses backslash, Unix uses forward slash
    // Check for Windows drive letter pattern first (e.g., C:\)
    const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(path) || path.includes('\\');
    const sep = isWindowsPath ? '\\' : '/';
    const parts = path.split(sep);
    if (parts.length <= 1) return null;
    parts.pop();
    return parts.join(sep);
  }

  private joinPath(...parts: string[]): string {
    if (parts.length === 0) return '';
    
    // Detect separator from first part
    // Check for Windows drive letter pattern first (e.g., C:\)
    const firstPart = parts[0] || '';
    const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(firstPart) || firstPart.includes('\\');
    const sep = isWindowsPath ? '\\' : '/';
    
    return parts
      .map((part, index) => {
        // Remove leading separator except for first part
        if (index > 0) {
          part = part.replace(/^[/\\]+/, '');
        }
        // Remove trailing separator
        part = part.replace(/[/\\]+$/, '');
        return part;
      })
      .filter(Boolean)
      .join(sep);
  }
}
