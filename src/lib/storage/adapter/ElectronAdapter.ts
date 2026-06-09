import { getElectronBridge } from '@/lib/electron/bridge';
import type { FileInfo, ListOptions, StorageAdapter, WriteOptions } from './types';

export const MAX_ELECTRON_RECURSIVE_LIST_ENTRIES = 20_000;

function getFs() {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron fs bridge is not available.');
  }
  return bridge.fs;
}

function getPathApi() {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron path bridge is not available.');
  }
  return bridge.path;
}

export class ElectronAdapter implements StorageAdapter {
  readonly platform = 'electron' as const;

  private basePath: string | null = null;

  async readFile(path: string): Promise<string> {
    return getFs().readTextFile(path);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    return getFs().readBinaryFile(path);
  }

  async writeFile(path: string, content: string, options?: WriteOptions): Promise<void> {
    await getFs().writeTextFile(path, content, options);
  }

  async writeBinaryFile(path: string, content: Uint8Array, options?: WriteOptions): Promise<void> {
    if (options?.recursive) {
      const normalized = path.replace(/[\\/]+$/, '');
      const lastSeparator = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
      if (lastSeparator > 0) {
        await getFs().mkdir(normalized.slice(0, lastSeparator), true);
      }
    }

    await getFs().writeBinaryFile(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    await getFs().deleteFile(path);
  }

  async deleteDir(path: string, recursive = false): Promise<void> {
    await getFs().deleteDir(path, recursive);
  }

  async exists(path: string): Promise<boolean> {
    return getFs().exists(path);
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    await getFs().mkdir(path, recursive);
  }

  async listDir(path: string, options?: ListOptions): Promise<FileInfo[]> {
    const entries = await getFs().listDir(path);
    const filtered = options?.includeHidden
      ? entries
      : entries.filter((entry) => !entry.name.startsWith('.'));

    if (!options?.recursive) {
      return filtered;
    }

    const nested: FileInfo[] = [];
    const visitedDirectories = new Set<string>([path]);
    const stack = [...filtered].reverse();

    while (stack.length > 0 && nested.length < MAX_ELECTRON_RECURSIVE_LIST_ENTRIES) {
      const entry = stack.pop();
      if (!entry) break;

      nested.push(entry);
      if (
        nested.length >= MAX_ELECTRON_RECURSIVE_LIST_ENTRIES ||
        nested.length + stack.length >= MAX_ELECTRON_RECURSIVE_LIST_ENTRIES ||
        !entry.isDirectory ||
        visitedDirectories.has(entry.path)
      ) {
        continue;
      }

      visitedDirectories.add(entry.path);
      const children = await getFs().listDir(entry.path);
      const visibleChildren = options?.includeHidden
        ? children
        : children.filter((entry) => !entry.name.startsWith('.'));

      for (let index = visibleChildren.length - 1; index >= 0; index -= 1) {
        stack.push(visibleChildren[index]);
      }
    }

    return nested;
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await getFs().rename(oldPath, newPath);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await getFs().copyFile(src, dest);
  }

  async stat(path: string): Promise<FileInfo | null> {
    return getFs().stat(path);
  }

  async getBasePath(): Promise<string> {
    if (this.basePath === null) {
      this.basePath = await getPathApi().appDataDir();
    }

    return this.basePath;
  }
}
