import { describe, expect, it, vi } from 'vitest';
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
  };

  registerWindowIpc({
    closeApprovedWebContents: new Set(),
    createWindow: vi.fn(),
    getWindowLabel: vi.fn(() => 'main'),
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
    resolveTargetWindow: vi.fn(() => window),
  });

  return { handlers, window };
}

describe('window ipc', () => {
  it('normalizes finite window dimensions before passing them to Electron', () => {
    expect(normalizeWindowDimension(640.4, 'width')).toBe(640);
    expect(normalizeWindowDimension(0, 'width')).toBe(1);
    expect(normalizeWindowDimension(20_000, 'width')).toBe(8192);
    expect(() => normalizeWindowDimension(Number.NaN, 'width')).toThrow('finite width');
  });

  it('clamps window size IPC arguments before calling BrowserWindow APIs', () => {
    const { handlers, window } = registerHarness();

    handlers.get('desktop:window:set-size')?.({}, 980.6, 0);
    handlers.get('desktop:window:set-min-size')?.({}, 20_000, 299.4);

    expect(window.setSize).toHaveBeenCalledWith(981, 1);
    expect(window.setMinimumSize).toHaveBeenCalledWith(8192, 299);
  });
});
