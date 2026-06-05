import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import electron from 'electron';
import { isPathInsideDirectory, registerDesktopIpc, revealItemInFolder } from '../../electron/desktopIpc.mjs';

const MAX_DESKTOP_IPC_BODY_BYTES = 64 * 1024 * 1024;
const MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES = 256 * 1024;
const MAX_CLIPBOARD_IMAGE_DATA_URL_BYTES = 10 * 1024 * 1024;

const hoisted = vi.hoisted(() => {
  const windows: any[] = [];
  const tempRoot = process.env.RUNNER_TEMP ?? process.env.TEMP ?? process.env.TMPDIR ?? '/tmp';
  const spawn = vi.fn(() => ({
    once: vi.fn(),
    unref: vi.fn(),
  }));

  class MockBrowserWindow {
    options: Record<string, unknown>;
    webContents: { printToPDF: ReturnType<typeof vi.fn> };
    loadFile = vi.fn(async () => undefined);
    loadURL = vi.fn(async () => undefined);
    destroy = vi.fn(() => {
      this.destroyed = true;
    });
    destroyed = false;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.webContents = {
        printToPDF: vi.fn(async () => new Uint8Array([1, 2, 3])),
      };
      windows.push(this);
    }

    isDestroyed() {
      return this.destroyed;
    }
  }

  return { MockBrowserWindow, spawn, tempRoot, windows };
});

vi.mock('node:child_process', () => ({
  default: {
    spawn: hoisted.spawn,
  },
  spawn: hoisted.spawn,
}));

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn(() => hoisted.tempRoot),
    },
    BrowserWindow: hoisted.MockBrowserWindow,
    clipboard: {
      writeText: vi.fn(),
      writeImage: vi.fn(),
    },
    nativeImage: {
      createFromDataURL: vi.fn(() => ({
        isEmpty: () => false,
      })),
    },
    dialog: {},
    shell: {
      openExternal: vi.fn(),
      openPath: vi.fn(),
      trashItem: vi.fn(),
      showItemInFolder: vi.fn(),
    },
  },
}));

function registerHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();

  registerDesktopIpc({
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
    normalizeExternalUrl: (url: string) => url,
    resolveTargetWindow: vi.fn(() => null),
    requireNonEmptyString: (value: string) => value,
    requireStringArray: (value: string[]) => value,
  });

  return { handlers };
}

function createOversizedBase64Body() {
  const encodedLength = Math.ceil((MAX_DESKTOP_IPC_BODY_BYTES + 1) / 3) * 4;
  return `${'A'.repeat(encodedLength - 1)}=`;
}

function createOversizedClipboardImageDataUrl() {
  const encodedLength = Math.ceil((MAX_CLIPBOARD_IMAGE_DATA_URL_BYTES + 1) / 3) * 4;
  return `data:image/png;base64,${'A'.repeat(encodedLength - 1)}=`;
}

describe('desktop export ipc', () => {
  it.each(['darwin', 'win32'] as const)(
    'uses the native shell reveal behavior on %s',
    async (platform) => {
      const shellImpl = {
        openPath: vi.fn(),
        showItemInFolder: vi.fn(),
      };
      const spawnDetached = vi.fn();

      await revealItemInFolder('/vault/docs/readme.md', {
        platform,
        shellImpl,
        spawnDetached,
      });

      expect(shellImpl.showItemInFolder).toHaveBeenCalledWith('/vault/docs/readme.md');
      expect(spawnDetached).not.toHaveBeenCalled();
    },
  );

  it('reveals the target item with a real file manager on Linux', async () => {
    const child = {
      once: vi.fn(),
      unref: vi.fn(),
    };
    const spawnDetached = vi.fn(() => child);
    const shellImpl = {
      openPath: vi.fn(),
      showItemInFolder: vi.fn(),
    };

    const options = {
      platform: 'linux',
      shellImpl,
      spawnDetached,
      envPath: '/usr/bin',
      exists: (candidatePath: string) => candidatePath === '/usr/bin/nautilus',
    } as const;
    await revealItemInFolder('/vault/docs/readme.md', options);
    await revealItemInFolder('/vault/docs/readme.md', options);

    expect(spawnDetached).toHaveBeenCalledTimes(2);
    expect(spawnDetached).toHaveBeenNthCalledWith(
      1,
      '/usr/bin/nautilus',
      ['--new-window', '--select', '/vault/docs/readme.md'],
      {
        detached: true,
        stdio: 'ignore',
      },
    );
    expect(spawnDetached).toHaveBeenNthCalledWith(
      2,
      '/usr/bin/nautilus',
      ['--new-window', '--select', '/vault/docs/readme.md'],
      {
        detached: true,
        stdio: 'ignore',
      },
    );
    expect(child.unref).toHaveBeenCalledTimes(2);
    expect(shellImpl.showItemInFolder).not.toHaveBeenCalled();
  });

  it('opens the containing folder on Linux when no selectable file manager is available', async () => {
    const child = {
      once: vi.fn(),
      unref: vi.fn(),
    };
    const spawnDetached = vi.fn(() => child);
    const shellImpl = {
      openPath: vi.fn(),
      showItemInFolder: vi.fn(),
    };

    await revealItemInFolder('/vault/docs/readme.md', {
      platform: 'linux',
      shellImpl,
      spawnDetached,
      envPath: '/usr/bin',
      exists: () => false,
    });

    expect(spawnDetached).toHaveBeenCalledWith('xdg-open', ['/vault/docs'], {
      detached: true,
      stdio: 'ignore',
    });
    expect(shellImpl.showItemInFolder).not.toHaveBeenCalled();
  });

  it('detects attempts to move a directory into its own child path', () => {
    expect(isPathInsideDirectory('/vault/docs', '/vault/docs/nested')).toBe(true);
    expect(isPathInsideDirectory('/vault/docs', '/vault/docs')).toBe(false);
    expect(isPathInsideDirectory('/vault/docs', '/vault/docs-archive')).toBe(false);
    expect(isPathInsideDirectory('/vault/docs', '/vault/other')).toBe(false);
  });

  it('writes data URL images to the native clipboard', async () => {
    const { handlers } = registerHarness();
    const imageDataUrl = 'data:image/png;base64,eA==';

    await handlers.get('desktop:clipboard:write-image')?.({}, imageDataUrl);

    expect(electron.nativeImage.createFromDataURL).toHaveBeenCalledWith(imageDataUrl);
    expect(electron.clipboard.writeImage).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized clipboard image data URLs before native decoding', async () => {
    const { handlers } = registerHarness();
    vi.mocked(electron.nativeImage.createFromDataURL).mockClear();

    await expect(
      handlers.get('desktop:clipboard:write-image')?.({}, createOversizedClipboardImageDataUrl()),
    ).rejects.toThrow('Clipboard image data URL is too large.');

    expect(electron.nativeImage.createFromDataURL).not.toHaveBeenCalled();
  });

  it('rejects invalid AI provider request headers before fetch', async () => {
    const { handlers } = registerHarness();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      handlers.get('desktop:ai-provider:request:start')?.(
        { sender: { isDestroyed: () => false, send: vi.fn() } },
        'request-headers',
        {
          url: 'https://api.example.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Authorization\nInjected': 'Bearer token',
          },
        },
      ),
    ).rejects.toThrow('Invalid AI provider request header');

    await expect(
      handlers.get('desktop:ai-provider:request:start')?.(
        { sender: { isDestroyed: () => false, send: vi.fn() } },
        'request-header-value',
        {
          url: 'https://api.example.com/v1/chat/completions',
          method: 'POST',
          headers: {
            Authorization: 'Bearer token\r\nInjected: value',
          },
        },
      ),
    ).rejects.toThrow('Invalid AI provider request header value');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe AI provider request ids before opening stream channels', async () => {
    const { handlers } = registerHarness();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      handlers.get('desktop:ai-provider:request:start')?.(
        { sender: { isDestroyed: () => false, send: vi.fn() } },
        'request\nother',
        { url: 'https://api.example.com/v1/chat/completions', method: 'POST' },
      ),
    ).rejects.toThrow('safe channel characters');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes base64 AI provider request bodies to fetch as bytes', async () => {
    const { handlers } = registerHarness();
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const sender = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    await handlers.get('desktop:ai-provider:request:start')?.(
      { sender },
      'request-bytes',
      {
        url: 'https://api.example.com/v1/images/edits',
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
        bodyBase64: Buffer.from('multipart-body').toString('base64'),
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/images/edits',
      expect.objectContaining({
        body: Buffer.from('multipart-body'),
      }),
    );
  });

  it('rejects oversized base64 AI provider request bodies before fetch', async () => {
    const { handlers } = registerHarness();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      handlers.get('desktop:ai-provider:request:start')?.(
        { sender: { isDestroyed: () => false, send: vi.fn() } },
        'request-oversized-base64',
        {
          url: 'https://api.example.com/v1/images/edits',
          method: 'POST',
          bodyBase64: createOversizedBase64Body(),
        },
      ),
    ).rejects.toThrow('AI provider request body is too large.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized text AI provider request bodies before fetch', async () => {
    const { handlers } = registerHarness();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      handlers.get('desktop:ai-provider:request:start')?.(
        { sender: { isDestroyed: () => false, send: vi.fn() } },
        'request-oversized-text',
        {
          url: 'https://api.example.com/v1/chat/completions',
          method: 'POST',
          body: '€'.repeat(Math.floor(MAX_DESKTOP_IPC_BODY_BYTES / 3) + 1),
        },
      ),
    ).rejects.toThrow('AI provider request body is too large.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('splits large AI provider response chunks before forwarding them over IPC', async () => {
    const { handlers } = registerHarness();
    const responseChunk = new Uint8Array(MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES + 3);
    responseChunk.set([1, 2, 3], MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES);
    const fetchMock = vi.fn(async () => new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(responseChunk);
          controller.close();
        },
      }),
      { status: 200, statusText: 'OK' },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const sender = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    await expect(handlers.get('desktop:ai-provider:request:start')?.(
      { sender },
      'request-large-response-chunk',
      {
        url: 'https://api.example.com/v1/chat/completions',
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
      },
    )).resolves.toMatchObject({
      status: 200,
      statusText: 'OK',
    });

    await vi.waitFor(() => expect(sender.send.mock.calls.some(
      ([channel]) => channel === 'desktop:ai-provider:request:request-large-response-chunk:done',
    )).toBe(true));
    const forwardedChunks = sender.send.mock.calls
      .filter(([channel]) => channel === 'desktop:ai-provider:request:request-large-response-chunk:chunk')
      .map(([, payload]) => payload);

    expect(forwardedChunks).toHaveLength(2);
    expect(forwardedChunks[0]).toHaveLength(MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES);
    expect(forwardedChunks[1]).toEqual([1, 2, 3]);
  });

  it('retries quickly failed AI provider transport requests once', async () => {
    vi.useFakeTimers();
    try {
      const { handlers } = registerHarness();
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(new Response('{}', { status: 200, statusText: 'OK' }));
      vi.stubGlobal('fetch', fetchMock);
      const sender = {
        isDestroyed: () => false,
        send: vi.fn(),
      };

      const request = handlers.get('desktop:ai-provider:request:start')?.(
        { sender },
        'request-retry',
        {
          url: 'https://api.example.com/v1/images/generations',
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-image-1', prompt: 'test' }),
        },
      ) as Promise<unknown> | undefined;

      await vi.advanceTimersByTimeAsync(300);

      await expect(request).resolves.toMatchObject({
        status: 200,
        statusText: 'OK',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries abort-shaped AI provider transport failures when the request was not cancelled', async () => {
    vi.useFakeTimers();
    try {
      const { handlers } = registerHarness();
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('upstream reset', 'AbortError'))
        .mockResolvedValueOnce(new Response('{}', { status: 200, statusText: 'OK' }));
      vi.stubGlobal('fetch', fetchMock);
      const sender = {
        isDestroyed: () => false,
        send: vi.fn(),
      };

      const request = handlers.get('desktop:ai-provider:request:start')?.(
        { sender },
        'request-abort-shaped-retry',
        {
          url: 'https://api.example.com/v1/chat/completions',
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
        },
      ) as Promise<unknown> | undefined;

      await vi.advanceTimersByTimeAsync(300);

      await expect(request).resolves.toMatchObject({
        status: 200,
        statusText: 'OK',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces a clear custom provider retry hint after transport retries fail', async () => {
    vi.useFakeTimers();
    try {
      const { handlers } = registerHarness();
      const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
      vi.stubGlobal('fetch', fetchMock);
      const sender = {
        isDestroyed: () => false,
        send: vi.fn(),
      };

      const request = handlers.get('desktop:ai-provider:request:start')?.(
        { sender },
        'request-retry-fail',
        {
          url: 'https://api.example.com/v1/images/generations',
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-image-1', prompt: 'test' }),
        },
      ) as Promise<unknown> | undefined;
      request?.catch(() => undefined);

      await vi.advanceTimersByTimeAsync(300);

      await expect(request).rejects.toThrow('连接到自定义渠道失败，可能是上游或网络瞬时不可达，可重试。');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry slower AI provider transport failures', async () => {
    vi.useFakeTimers();
    try {
      const { handlers } = registerHarness();
      const fetchMock = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2100));
        throw new TypeError('fetch failed');
      });
      vi.stubGlobal('fetch', fetchMock);
      const sender = {
        isDestroyed: () => false,
        send: vi.fn(),
      };

      const request = handlers.get('desktop:ai-provider:request:start')?.(
        { sender },
        'request-slow-fail',
        {
          url: 'https://api.example.com/v1/images/generations',
          method: 'POST',
          body: JSON.stringify({ model: 'gpt-image-1', prompt: 'test' }),
        },
      ) as Promise<unknown> | undefined;
      request?.catch(() => undefined);

      await vi.advanceTimersByTimeAsync(2100);

      await expect(request).rejects.toThrow('连接到自定义渠道失败，可能是上游或网络瞬时不可达，可重试。');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects AI provider request start promptly when fetch ignores cancellation', async () => {
    const { handlers } = registerHarness();
    const fetchMock = vi.fn((_url, init) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return new Promise(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);
    const sender = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    const request = handlers.get('desktop:ai-provider:request:start')?.(
      { sender },
      'request-ignores-abort',
      { url: 'https://api.example.com/v1/chat/completions', method: 'POST' },
    ) as Promise<unknown> | undefined;
    request?.catch(() => undefined);

    await Promise.resolve();
    await handlers.get('desktop:ai-provider:request:cancel')?.({}, 'request-ignores-abort');

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('does not let an old AI provider stream cleanup or abort event affect a newer request with the same id', async () => {
    const { handlers } = registerHarness();
    const signals: AbortSignal[] = [];
    const cancelFirstStream = vi.fn();
    const firstStream = new ReadableStream<Uint8Array>({
      start() {
      },
      cancel() {
        cancelFirstStream();
      },
    });
    const secondStream = new ReadableStream<Uint8Array>({
      start() {
      },
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Response(firstStream);
      })
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Response(secondStream);
      });
    vi.stubGlobal('fetch', fetchMock);
    const sender = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    await handlers.get('desktop:ai-provider:request:start')?.(
      { sender },
      'request-1',
      { url: 'https://api.example.com/v1/chat/completions', method: 'POST' },
    );
    await handlers.get('desktop:ai-provider:request:start')?.(
      { sender },
      'request-1',
      { url: 'https://api.example.com/v1/chat/completions', method: 'POST' },
    );
    await Promise.resolve();
    await Promise.resolve();

    await handlers.get('desktop:ai-provider:request:cancel')?.({}, 'request-1');

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(true);
    expect(cancelFirstStream).toHaveBeenCalledTimes(1);
    expect(sender.send).not.toHaveBeenCalledWith(
      'desktop:ai-provider:request:request-1:error',
      { message: 'Aborted' },
    );
  });

  it('does not emit stale AI provider reader failures after cancellation', async () => {
    const { handlers } = registerHarness();
    let rejectRead: ((error: Error) => void) | undefined;
    let resolveReadStarted: (() => void) | undefined;
    const readStarted = new Promise<void>((resolve) => {
      resolveReadStarted = resolve;
    });
    const reader = {
      read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>((_resolve, reject) => {
        rejectRead = reject;
        resolveReadStarted?.();
      })),
      cancel: vi.fn(async () => {
        rejectRead?.(new Error('native reader failed after abort'));
      }),
      releaseLock: vi.fn(),
    };
    const fetchMock = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: {
        getReader: () => reader,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const sender = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    await handlers.get('desktop:ai-provider:request:start')?.(
      { sender },
      'request-reader-abort',
      { url: 'https://api.example.com/v1/chat/completions', method: 'POST' },
    );
    await readStarted;
    await handlers.get('desktop:ai-provider:request:cancel')?.({}, 'request-reader-abort');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sender.send).not.toHaveBeenCalledWith(
      'desktop:ai-provider:request:request-reader-abort:error',
      { message: 'Aborted' },
    );
    expect(sender.send).not.toHaveBeenCalledWith(
      'desktop:ai-provider:request:request-reader-abort:error',
      { message: 'native reader failed after abort' },
    );
  });

  it('releases AI provider stream readers promptly when read and cancel both ignore abort', async () => {
    const { handlers } = registerHarness();
    const fakeReader = {
      read: vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(() => undefined)),
      cancel: vi.fn(() => new Promise<void>(() => undefined)),
      releaseLock: vi.fn(),
    };
    const fetchMock = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: {
        getReader: () => fakeReader,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const sender = {
      isDestroyed: () => false,
      send: vi.fn(),
    };

    await handlers.get('desktop:ai-provider:request:start')?.(
      { sender },
      'request-reader-hangs',
      { url: 'https://api.example.com/v1/chat/completions', method: 'POST' },
    );
    await vi.waitFor(() => expect(fakeReader.read).toHaveBeenCalled());
    await handlers.get('desktop:ai-provider:request:cancel')?.({}, 'request-reader-hangs');

    await vi.waitFor(() => expect(fakeReader.releaseLock).toHaveBeenCalledTimes(1));
    expect(fakeReader.cancel).toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalledWith(
      'desktop:ai-provider:request:request-reader-hangs:error',
      { message: 'Aborted' },
    );
  });

  it('renders PDF HTML through a temporary file instead of a data URL', async () => {
    hoisted.windows.length = 0;
    const { handlers } = registerHarness();

    await expect(
      handlers.get('desktop:export:html-to-pdf')?.({}, '<!doctype html><html><body>Export</body></html>', {
        pageSize: 'A4',
      }),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]));

    const win = hoisted.windows[0];
    expect(win.loadFile).toHaveBeenCalledTimes(1);
    const loadedFilePath = String(win.loadFile.mock.calls[0]?.[0]);
    expect(path.basename(loadedFilePath)).toBe('export.html');
    expect(path.basename(path.dirname(loadedFilePath))).toMatch(/^vlaina-export-/);
    expect(path.dirname(path.dirname(loadedFilePath))).toBe(path.resolve(hoisted.tempRoot));
    expect(win.loadURL).not.toHaveBeenCalled();
    expect(win.webContents.printToPDF).toHaveBeenCalledWith({
      landscape: false,
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 0.4,
        bottom: 0.45,
        left: 0.45,
        right: 0.45,
      },
    });
    expect(win.destroy).toHaveBeenCalledTimes(1);
  });
});
