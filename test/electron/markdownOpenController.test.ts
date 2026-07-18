import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMarkdownOpenController } from '../../electron/markdownOpenController.mjs';

type Listener = (...args: unknown[]) => void;

function createEventTarget() {
  const listeners = new Map<string, Listener[]>();

  return {
    emit(eventName: string, ...args: unknown[]) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener(...args);
      }
    },
    off(eventName: string, listener: Listener) {
      listeners.set(eventName, (listeners.get(eventName) ?? []).filter((item) => item !== listener));
    },
    on(eventName: string, listener: Listener) {
      listeners.set(eventName, [...(listeners.get(eventName) ?? []), listener]);
    },
    once(eventName: string, listener: Listener) {
      const onceListener: Listener = (...args) => {
        this.off(eventName, onceListener);
        listener(...args);
      };
      this.on(eventName, onceListener);
    },
  };
}

function createHarness({
  existingWindow = false,
  isLoading = false,
  normalizeMarkdownOpenPath = () => null as string | null,
} = {}) {
  const windowEvents = createEventTarget();
  const webContentsEvents = createEventTarget();
  const webContents = {
    ...webContentsEvents,
    isLoading: vi.fn(() => isLoading),
    send: vi.fn(),
  };
  const window = {
    ...windowEvents,
    focus: vi.fn(),
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    webContents,
  };
  const controller = createMarkdownOpenController({
    BrowserWindow: { getAllWindows: vi.fn(() => existingWindow ? [window] : []) },
    authorizeFsPath: vi.fn(),
    createMainWindow: vi.fn(() => window),
    isReadyToReveal: vi.fn(() => false),
    normalizeMarkdownOpenPath: vi.fn(normalizeMarkdownOpenPath),
  });

  return { controller, webContents, window };
}

describe('Markdown open controller startup wait', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back after a bounded wait when startup ready never arrives', () => {
    vi.useFakeTimers();
    const { controller, webContents } = createHarness();

    expect(controller.requestOpenMarkdownFile()).toBe(true);
    vi.advanceTimersByTime(19);
    expect(webContents.send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(webContents.send).toHaveBeenCalledTimes(1);
    expect(webContents.send).toHaveBeenCalledWith('desktop:shortcut:open-markdown-file');
  });

  it('uses startup ready immediately and clears the fallback', () => {
    vi.useFakeTimers();
    const { controller, webContents } = createHarness();

    controller.requestOpenMarkdownFile();
    webContents.emit('ipc-message', {}, 'desktop:startup-ready');
    vi.advanceTimersByTime(20);

    expect(webContents.send).toHaveBeenCalledTimes(1);
  });

  it('clears the pending startup request when the window closes', () => {
    vi.useFakeTimers();
    const { controller, webContents, window } = createHarness();

    controller.requestOpenMarkdownFile();
    window.emit('closed');
    vi.advanceTimersByTime(20);

    expect(webContents.send).not.toHaveBeenCalled();
  });

  it('bounds the renderer-load wait for an existing window', () => {
    vi.useFakeTimers();
    const { controller, webContents } = createHarness({ existingWindow: true, isLoading: true });

    controller.requestOpenMarkdownFile();
    vi.advanceTimersByTime(19);
    expect(webContents.send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(webContents.send).toHaveBeenCalledWith('desktop:shortcut:open-markdown-file');
  });

  it('bounds the renderer-load wait when opening a Markdown path', async () => {
    vi.useFakeTimers();
    const { controller, webContents } = createHarness({
      existingWindow: true,
      isLoading: true,
      normalizeMarkdownOpenPath: (value?: unknown) => typeof value === 'string' ? value : null,
    });

    await expect(controller.openMarkdownPath('/notes/demo.md')).resolves.toBe(true);
    vi.advanceTimersByTime(20);

    expect(webContents.send).toHaveBeenCalledWith('desktop:app:open-markdown-file', '/notes/demo.md');
  });
});
