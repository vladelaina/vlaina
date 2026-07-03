import { describe, expect, it, vi } from 'vitest';
import electron from 'electron';
import { normalizeWindowDimension, registerWindowIpc } from '../../electron/windowIpc.mjs';

vi.mock('electron', () => ({
  default: {
    BrowserWindow: {
      getAllWindows: vi.fn(() => []),
    },
  },
}));

function registerHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const window = {
    setMinimumSize: vi.fn(),
    setSize: vi.fn(),
    setBackgroundColor: vi.fn(),
    setTitleBarOverlay: vi.fn(),
  };
  const createWindow = vi.fn();

  registerWindowIpc({
    closeApprovedWebContents: new Set(),
    createWindow,
    getWindowLabel: vi.fn(() => 'main'),
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
    resolveTargetWindow: vi.fn(() => window),
  });

  return { createWindow, handlers, window };
}

function withPlatform(platform: NodeJS.Platform, testBody: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform });

  try {
    testBody();
  } finally {
    if (descriptor) {
      Object.defineProperty(process, 'platform', descriptor);
    }
  }
}

describe('window ipc', () => {
  it('normalizes finite window dimensions before passing them to Electron', () => {
    expect(normalizeWindowDimension(640.4, 'width')).toBe(640);
    expect(normalizeWindowDimension('640.4', 'width')).toBe(640);
    expect(normalizeWindowDimension(0, 'width')).toBe(1);
    expect(normalizeWindowDimension(20_000, 'width')).toBe(8192);
    expect(() => normalizeWindowDimension(Number.NaN, 'width')).toThrow('finite width');
    expect(() => normalizeWindowDimension('1e3', 'width')).toThrow('finite width');
  });

  it('rejects object window dimensions without coercion', () => {
    let stringReads = 0;
    const throwingValue = {
      toString() {
        stringReads += 1;
        throw new Error('Unexpected window dimension coercion');
      },
    };

    expect(() => normalizeWindowDimension(throwingValue, 'width')).toThrow('finite width');
    expect(stringReads).toBe(0);
  });

  it('clamps window size IPC arguments before calling BrowserWindow APIs', () => {
    const { handlers, window } = registerHarness();

    handlers.get('desktop:window:set-size')?.({}, 980.6, 0);
    handlers.get('desktop:window:set-min-size')?.({}, 20_000, 299.4);

    expect(window.setSize).toHaveBeenCalledWith(981, 1);
    expect(window.setMinimumSize).toHaveBeenCalledWith(8192, 299);
  });

  it('keeps the Windows titlebar overlay hidden while theme colors change', () => {
    const { handlers, window } = registerHarness();

    withPlatform('win32', () => {
      handlers.get('desktop:window:set-theme-colors')?.({}, {
        backgroundColor: '#fcfcfc',
        titleBarOverlayColor: '#fcfcfc',
        titleBarSymbolColor: '#27262b',
      });
      expect(window.setTitleBarOverlay).toHaveBeenLastCalledWith({
        color: '#fcfcfc',
        symbolColor: '#27262b',
        height: 40,
      });

      expect(handlers.get('desktop:window:set-titlebar-overlay-visible')?.({}, false)).toBe(true);
      expect(window.setTitleBarOverlay).toHaveBeenLastCalledWith({
        color: '#fcfcfc',
        symbolColor: '#27262b',
        height: 0,
      });

      handlers.get('desktop:window:set-theme-colors')?.({}, {
        backgroundColor: '#050505',
        titleBarOverlayColor: '#050505',
        titleBarSymbolColor: '#ededee',
      });
      expect(window.setTitleBarOverlay).toHaveBeenLastCalledWith({
        color: '#050505',
        symbolColor: '#ededee',
        height: 0,
      });

      expect(handlers.get('desktop:window:set-titlebar-overlay-visible')?.({}, true)).toBe(true);
      expect(window.setTitleBarOverlay).toHaveBeenLastCalledWith({
        color: '#050505',
        symbolColor: '#ededee',
        height: 40,
      });
    });
  });

  it('passes notes root launch targets to new windows', () => {
    const { createWindow, handlers } = registerHarness();

    handlers.get('desktop:window:create')?.({}, {
      notesRootPath: '/notes-root/docs',
      notePath: 'readme.md',
      folderPath: 'docs',
      chatSessionId: '',
      viewMode: 'notes',
    });

    expect(createWindow).toHaveBeenCalledWith({
      newWindow: true,
      notesRootPath: '/notes-root/docs',
      notePath: 'readme.md',
      folderPath: 'docs',
      chatSessionId: null,
      viewMode: 'notes',
    });
  });

  it('restores and shows a labeled window before focusing it', () => {
    const targetWindow = {
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    };
    const otherWindow = {
      isMinimized: vi.fn(() => false),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    };
    vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([otherWindow, targetWindow] as never);
    const getWindowLabel = vi.fn((window) => (window === targetWindow ? 'main' : 'secondary'));
    const handlers = new Map<string, (...args: unknown[]) => unknown>();

    registerWindowIpc({
      closeApprovedWebContents: new Set(),
      createWindow: vi.fn(),
      getWindowLabel,
      handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(name, handler);
      },
      resolveTargetWindow: vi.fn(),
    });

    expect(handlers.get('desktop:window:focus')?.({}, 'main')).toBe(true);
    expect(targetWindow.restore).toHaveBeenCalledTimes(1);
    expect(targetWindow.show).toHaveBeenCalledTimes(1);
    expect(targetWindow.focus).toHaveBeenCalledTimes(1);
    expect(otherWindow.show).not.toHaveBeenCalled();
  });
});
