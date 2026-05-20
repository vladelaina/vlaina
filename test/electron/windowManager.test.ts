import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWindowManager } from '../../electron/windowManager.mjs';

type Listener = (...args: unknown[]) => void;

const hoisted = vi.hoisted(() => {
  const windows: MockBrowserWindow[] = [];
  let nextWindowId = 1;

  class MockWebContents {
    id = nextWindowId * 10;
    listeners = new Map<string, Listener[]>();
    destroyed = false;
    send = vi.fn();
    setWindowOpenHandler = vi.fn();

    isDestroyed() {
      return this.destroyed;
    }

    once(eventName: string, listener: Listener) {
      const onceListener: Listener = (...args) => {
        this.removeListener(eventName, onceListener);
        listener(...args);
      };
      this.on(eventName, onceListener);
    }

    on(eventName: string, listener: Listener) {
      this.listeners.set(eventName, [...(this.listeners.get(eventName) ?? []), listener]);
    }

    removeListener(eventName: string, listener: Listener) {
      this.listeners.set(
        eventName,
        (this.listeners.get(eventName) ?? []).filter((item) => item !== listener),
      );
    }

    emit(eventName: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(eventName) ?? []) {
        listener(...args);
      }
    }
  }

  class MockBrowserWindow {
    id = nextWindowId++;
    webContents = new MockWebContents();
    listeners = new Map<string, Listener[]>();
    show = vi.fn();
    focus = vi.fn();
    close = vi.fn();
    loadURL = vi.fn(async () => undefined);
    loadFile = vi.fn(async () => undefined);
    destroyed = false;

    constructor() {
      windows.push(this);
    }

    isDestroyed() {
      return this.destroyed;
    }

    once(eventName: string, listener: Listener) {
      const onceListener: Listener = (...args) => {
        this.removeListener(eventName, onceListener);
        listener(...args);
      };
      this.on(eventName, onceListener);
    }

    on(eventName: string, listener: Listener) {
      this.listeners.set(eventName, [...(this.listeners.get(eventName) ?? []), listener]);
    }

    removeListener(eventName: string, listener: Listener) {
      this.listeners.set(
        eventName,
        (this.listeners.get(eventName) ?? []).filter((item) => item !== listener),
      );
    }

    emit(eventName: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(eventName) ?? []) {
        listener(...args);
      }
    }
  }

  return {
    MockBrowserWindow,
    windows,
    reset() {
      windows.length = 0;
      nextWindowId = 1;
    },
  };
});

vi.mock('electron', () => ({
  default: {
    BrowserWindow: Object.assign(hoisted.MockBrowserWindow, {
      fromWebContents: vi.fn((webContents) =>
        hoisted.windows.find((window) => window.webContents === webContents) ?? null
      ),
      getAllWindows: vi.fn(() => hoisted.windows),
      getFocusedWindow: vi.fn(() => null),
    }),
  },
}));

function createHarness() {
  const manager = createWindowManager({
    rendererDevUrl: 'http://localhost:3000',
    appIconPath: 'icon.png',
    isDevelopment: () => true,
    openExternalIfAllowed: vi.fn(),
    isTrustedRendererUrl: vi.fn(() => true),
  });

  return manager.createMainWindow() as unknown as InstanceType<typeof hoisted.MockBrowserWindow>;
}

function createIpcHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const manager = createWindowManager({
    rendererDevUrl: 'http://localhost:3000',
    appIconPath: 'icon.png',
    isDevelopment: () => true,
    openExternalIfAllowed: vi.fn(),
    isTrustedRendererUrl: vi.fn(() => true),
  });

  manager.registerWindowIpc((name, handler) => {
    handlers.set(name, handler);
  });

  return { handlers };
}

describe('window manager reveal timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for ready-to-show after the renderer reports startup ready', () => {
    const window = createHarness();

    window.webContents.emit('ipc-message', {}, 'desktop:startup-ready');
    expect(window.show).not.toHaveBeenCalled();

    window.emit('ready-to-show');

    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
  });

  it('keeps the did-finish-load fallback when ready-to-show is delayed', () => {
    const window = createHarness();

    window.webContents.emit('ipc-message', {}, 'desktop:startup-ready');
    window.webContents.emit('did-finish-load');
    vi.advanceTimersByTime(2999);
    expect(window.show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(window.show).toHaveBeenCalledTimes(1);
  });

  it('reveals user-created new windows immediately while renderer content loads', () => {
    const { handlers } = createIpcHarness();

    handlers.get('desktop:window:create')?.({}, { viewMode: 'chat' });
    const window = hoisted.windows[0];

    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
    expect(window.loadURL).toHaveBeenCalledWith('http://localhost:3000/?newWindow=true&viewMode=chat');
  });
});
