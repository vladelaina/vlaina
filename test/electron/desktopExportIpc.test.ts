import { describe, expect, it, vi } from 'vitest';
import { registerDesktopIpc } from '../../electron/desktopIpc.mjs';

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
