import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const MAX_DESKTOP_FS_WRITE_BYTES = 64 * 1024 * 1024;

interface PreloadFsApi {
  writeBinaryFile(filePath: string, bytes: Uint8Array | ArrayLike<number>): Promise<unknown>;
  writeTextFile(filePath: string, content: string, options?: { recursive?: boolean; append?: boolean }): Promise<unknown>;
  watch(
    filePath: string,
    callback: (payload: unknown) => void | Promise<void>,
    options?: { recursive?: boolean }
  ): Promise<() => Promise<void>>;
}

interface PreloadApi {
  app: {
    onOpenMarkdownFile(callback: (filePath: string) => void | Promise<void>): () => void;
  };
  fs: PreloadFsApi;
  aiProvider: {
    onRequestChunk(requestId: string, callback: (chunk: unknown) => void | Promise<void>): () => void;
  };
  account: {
    onManagedStreamError(requestId: string, callback: (payload: unknown) => void | Promise<void>): () => void;
  };
}

async function loadPreloadApi(): Promise<{
  api: PreloadApi;
  fs: PreloadFsApi;
  ipcRenderer: {
    invoke: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };
}> {
  const exposed: Record<string, PreloadApi> = {};
  const ipcRenderer = {
    on: vi.fn(),
    invoke: vi.fn(async () => undefined),
    send: vi.fn(),
    removeListener: vi.fn(),
  };
  const contextBridge = {
    exposeInMainWorld: vi.fn((name: string, api: PreloadApi) => {
      exposed[name] = api;
    }),
  };
  const webUtils = {
    getPathForFile: vi.fn(),
  };
  const preloadPath = path.resolve(process.cwd(), 'electron/preload.cjs');
  const code = await readFile(preloadPath, 'utf8');
  const context = vm.createContext({
    Buffer,
    console,
    require: (id: string) => {
      if (id === 'electron') {
        return { contextBridge, ipcRenderer, webUtils };
      }
      throw new Error(`Unexpected preload require: ${id}`);
    },
  });

  vm.runInContext(code, context, { filename: preloadPath });

  const api = exposed.vlainaDesktop;
  if (!api) {
    throw new Error('Preload did not expose vlainaDesktop.');
  }

  return { api, fs: api.fs, ipcRenderer };
}

describe('preload filesystem budgets', () => {
  it('bounds pending open markdown events before listeners register', async () => {
    const { api, ipcRenderer } = await loadPreloadApi();
    const openHandler = ipcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'desktop:app:open-markdown-file',
    )?.[1];
    if (typeof openHandler !== 'function') {
      throw new Error('open markdown handler was not registered.');
    }

    openHandler({}, '/tmp/ignored.txt');
    openHandler({}, `/tmp/${'x'.repeat(8192)}.md`);
    for (let index = 0; index < 40; index += 1) {
      openHandler({}, `/tmp/note-${index}.md`);
    }

    const callback = vi.fn();
    const dispose = api.app.onOpenMarkdownFile(callback);

    expect(callback).toHaveBeenCalledTimes(32);
    expect(callback.mock.calls[0]?.[0]).toBe('/tmp/note-8.md');
    expect(callback.mock.calls[31]?.[0]).toBe('/tmp/note-39.md');

    openHandler({}, '/tmp/live.markdown');
    openHandler({}, '/tmp/live.txt');
    expect(callback).toHaveBeenCalledTimes(33);
    expect(callback.mock.calls[32]?.[0]).toBe('/tmp/live.markdown');

    dispose();
  });

  it('rejects oversized binary writes before materializing arrays or sending IPC', async () => {
    const { fs, ipcRenderer } = await loadPreloadApi();
    const oversizedBytes = {
      length: MAX_DESKTOP_FS_WRITE_BYTES + 1,
      [Symbol.iterator]: function* iterator() {
        throw new Error('Oversized payload should not be iterated.');
      },
    } as ArrayLike<number>;

    expect(() => fs.writeBinaryFile('/tmp/huge.bin', oversizedBytes)).toThrow(
      'Desktop content is too large to write.',
    );
    expect(ipcRenderer.invoke).not.toHaveBeenCalled();
  });

  it('forwards small filesystem writes with normalized payloads', async () => {
    const { fs, ipcRenderer } = await loadPreloadApi();

    await fs.writeBinaryFile('/tmp/image.bin', new Uint8Array([1, 2, 3]));
    await fs.writeTextFile('/tmp/note.md', 'hello', { append: true });

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'desktop:fs:write-binary',
      '/tmp/image.bin',
      new Uint8Array([1, 2, 3]),
    );
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'desktop:fs:write-text',
      '/tmp/note.md',
      'hello',
      { append: true },
    );
  });

  it('normalizes binary writes without trusting custom iterators', async () => {
    const { fs, ipcRenderer } = await loadPreloadApi();
    const bytes = {
      0: 7,
      length: 1,
      [Symbol.iterator]: function* iterator() {
        throw new Error('Binary payload iterator should not be used.');
      },
    } as ArrayLike<number>;

    await fs.writeBinaryFile('/tmp/one.bin', bytes);

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(
      'desktop:fs:write-binary',
      '/tmp/one.bin',
      [7],
    );
  });

  it('rejects object request ids and text writes without coercion', async () => {
    const { api, fs, ipcRenderer } = await loadPreloadApi();
    let stringReads = 0;
    const throwingValue = {
      toString() {
        stringReads += 1;
        throw new Error('Unexpected preload coercion');
      },
    };

    expect(() => api.aiProvider.onRequestChunk(throwingValue as never, () => undefined)).toThrow(
      'AI provider request id must contain only safe channel characters.',
    );
    expect(() => fs.writeTextFile('/tmp/note.md', throwingValue as never)).toThrow(
      'Desktop text content must be a primitive value.',
    );
    expect(stringReads).toBe(0);
    expect(ipcRenderer.invoke).not.toHaveBeenCalled();
  });

  it('does not return rejected watch callback promises to ipc listeners', async () => {
    const { fs, ipcRenderer } = await loadPreloadApi();
    ipcRenderer.invoke.mockResolvedValueOnce('watch-safe-id');
    const callback = vi.fn(async () => {
      throw new Error('watch callback failed');
    });

    const unwatch = await fs.watch('/tmp/vault', callback, { recursive: true });
    const handler = ipcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'desktop:fs:watch:watch-safe-id',
    )?.[1];
    if (typeof handler !== 'function') {
      throw new Error('watch handler was not registered.');
    }

    expect(handler({}, { paths: ['/tmp/vault/a.md'] })).toBeUndefined();
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith({ paths: ['/tmp/vault/a.md'] });

    await unwatch();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('desktop:fs:watch:watch-safe-id', handler);
    expect(ipcRenderer.invoke).toHaveBeenLastCalledWith('desktop:fs:unwatch', 'watch-safe-id');
  });

  it('does not surface rejected stream callbacks through ipc listeners', async () => {
    const { api, ipcRenderer } = await loadPreloadApi();
    const chunkCallback = vi.fn(() => {
      throw new Error('chunk callback failed');
    });
    const errorCallback = vi.fn(async () => {
      throw new Error('stream error callback failed');
    });

    const disposeChunk = api.aiProvider.onRequestChunk('request-1', chunkCallback);
    const disposeError = api.account.onManagedStreamError('stream-1', errorCallback);
    const chunkHandler = ipcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'desktop:ai-provider:request:request-1:chunk',
    )?.[1];
    const errorHandler = ipcRenderer.on.mock.calls.find(
      ([channel]) => channel === 'desktop:managed:stream:stream-1:error',
    )?.[1];
    if (typeof chunkHandler !== 'function' || typeof errorHandler !== 'function') {
      throw new Error('stream handlers were not registered.');
    }

    expect(chunkHandler({}, [1, 2, 3])).toBeUndefined();
    expect(errorHandler({}, { message: 'failed' })).toBeUndefined();
    await Promise.resolve();
    expect(chunkCallback).toHaveBeenCalledWith([1, 2, 3]);
    expect(errorCallback).toHaveBeenCalledWith({ message: 'failed' });

    disposeChunk();
    disposeError();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'desktop:ai-provider:request:request-1:chunk',
      chunkHandler,
    );
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(
      'desktop:managed:stream:stream-1:error',
      errorHandler,
    );
  });
});
