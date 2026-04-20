import { getElectronBridge } from '@/lib/electron/bridge';
import type { FileInfo, ListOptions, StorageAdapter, WriteOptions } from './types';

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

    const nested = await Promise.all(
      filtered.map(async (entry) => {
        if (!entry.isDirectory) {
          return [entry];
        }

        const children = await this.listDir(entry.path, options);
        return [entry, ...children];
      }),
    );

    return nested.flat();
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
