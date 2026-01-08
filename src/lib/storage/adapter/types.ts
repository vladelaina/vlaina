/**
 * Storage Adapter Interface
 * 
 * Unified interface for file system operations across platforms:
 * - Desktop (Tauri): Uses @tauri-apps/plugin-fs
 * - Web: Uses IndexedDB
 */

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  modifiedAt?: number;
}

export interface WriteOptions {
  /** Create parent directories if they don't exist */
  recursive?: boolean;
  /** Append to file instead of overwriting */
  append?: boolean;
}

export interface ReadOptions {
  /** Read as binary (Uint8Array) instead of text */
  binary?: boolean;
}

export interface ListOptions {
  /** Include hidden files (starting with .) */
  includeHidden?: boolean;
  /** Recursive listing */
  recursive?: boolean;
}

export interface StorageAdapter {
  /** Platform identifier */
  readonly platform: 'tauri' | 'web';

  /**
   * Read file content as text
   */
  readFile(path: string): Promise<string>;

  /**
   * Read file content as binary
   */
  readBinaryFile(path: string): Promise<Uint8Array>;

  /**
   * Write text content to file
   */
  writeFile(path: string, content: string, options?: WriteOptions): Promise<void>;

  /**
   * Write binary content to file
   */
  writeBinaryFile(path: string, content: Uint8Array, options?: WriteOptions): Promise<void>;

  /**
   * Delete a file
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Delete a directory (and optionally its contents)
   */
  deleteDir(path: string, recursive?: boolean): Promise<void>;

  /**
   * Check if a file or directory exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Create a directory
   */
  mkdir(path: string, recursive?: boolean): Promise<void>;

  /**
   * List directory contents
   */
  listDir(path: string, options?: ListOptions): Promise<FileInfo[]>;

  /**
   * Rename/move a file or directory
   */
  rename(oldPath: string, newPath: string): Promise<void>;

  /**
   * Copy a file
   */
  copyFile(src: string, dest: string): Promise<void>;

  /**
   * Get file/directory info
   */
  stat(path: string): Promise<FileInfo | null>;

  /**
   * Get the base path for app data storage
   * - Tauri: System app data directory
   * - Web: Virtual root "/"
   */
  getBasePath(): Promise<string>;
}
