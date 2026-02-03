export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  modifiedAt?: number;
}

export interface WriteOptions {
  recursive?: boolean;
  append?: boolean;
}

export interface ReadOptions {
  binary?: boolean;
}

export interface ListOptions {
  includeHidden?: boolean;
  recursive?: boolean;
}

export interface StorageAdapter {
  readonly platform: 'tauri' | 'web';
  readFile(path: string): Promise<string>;
  readBinaryFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string, options?: WriteOptions): Promise<void>;
  writeBinaryFile(path: string, content: Uint8Array, options?: WriteOptions): Promise<void>;
  deleteFile(path: string): Promise<void>;
  deleteDir(path: string, recursive?: boolean): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, recursive?: boolean): Promise<void>;
  listDir(path: string, options?: ListOptions): Promise<FileInfo[]>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  stat(path: string): Promise<FileInfo | null>;
  getBasePath(): Promise<string>;
}
