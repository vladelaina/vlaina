import { describe, expect, it, vi } from 'vitest';
import { isPathInsideDirectory, registerDesktopIpc } from '../../electron/desktopIpc.mjs';

const hoisted = vi.hoisted(() => {
  const windows: any[] = [];

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

  return { MockBrowserWindow, windows };
});

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn(() => '/tmp'),
    },
    BrowserWindow: hoisted.MockBrowserWindow,
    clipboard: {
      writeText: vi.fn(),
    },
    dialog: {},
    shell: {
      openExternal: vi.fn(),
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

describe('desktop export ipc', () => {
  it('detects attempts to move a directory into its own child path', () => {
    expect(isPathInsideDirectory('/vault/docs', '/vault/docs/nested')).toBe(true);
    expect(isPathInsideDirectory('/vault/docs', '/vault/docs')).toBe(false);
    expect(isPathInsideDirectory('/vault/docs', '/vault/docs-archive')).toBe(false);
    expect(isPathInsideDirectory('/vault/docs', '/vault/other')).toBe(false);
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

  it('does not let an old AI provider stream cleanup remove a newer request with the same id', async () => {
    const { handlers } = registerHarness();
    const signals: AbortSignal[] = [];
    let closeFirstStream!: () => void;
    const firstStream = new ReadableStream<Uint8Array>({
      start(controller) {
        closeFirstStream = () => controller.close();
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
    closeFirstStream();
    await Promise.resolve();
    await Promise.resolve();

    await handlers.get('desktop:ai-provider:request:cancel')?.({}, 'request-1');

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(true);
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
    expect(win.loadFile.mock.calls[0]?.[0]).toMatch(/\/tmp\/vlaina-export-.*\/export\.html$/);
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
