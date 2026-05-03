import { describe, expect, it, vi } from 'vitest';
import { registerDesktopDialogIpc } from '../../electron/desktopDialogIpc.mjs';

function registerHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const dialog = {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  };
  const authorizeFsPath = vi.fn().mockResolvedValue(undefined);

  registerDesktopDialogIpc({
    app: { isPackaged: true },
    dialog,
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
    resolveTargetWindow: vi.fn(() => null),
    authorizeFsPath,
  });

  return { handlers, dialog, authorizeFsPath };
}

describe('desktop dialog ipc', () => {
  it('authorizes selected Markdown files and their parent watch roots', async () => {
    const { handlers, dialog, authorizeFsPath } = registerHarness();
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/vault/docs/a.md'],
    });

    await expect(handlers.get('desktop:dialog:open')?.({}, {
      authorizeParentDirectory: true,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })).resolves.toBe('/vault/docs/a.md');

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(undefined, {
      title: undefined,
      defaultPath: undefined,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['openFile'],
    });
    expect(authorizeFsPath).toHaveBeenCalledWith('/vault/docs/a.md', 'file');
    expect(authorizeFsPath).toHaveBeenCalledWith('/vault/docs', 'root');
    expect(authorizeFsPath).toHaveBeenCalledWith('/vault', 'watch-root');
  });

  it('authorizes selected folders as roots without file filters', async () => {
    const { handlers, dialog, authorizeFsPath } = registerHarness();
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/vault/empty'],
    });

    await expect(handlers.get('desktop:dialog:open')?.({}, {
      directory: true,
      defaultPath: '/vault',
    })).resolves.toBe('/vault/empty');

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(undefined, {
      title: undefined,
      defaultPath: '/vault',
      filters: undefined,
      properties: ['openDirectory'],
    });
    expect(authorizeFsPath).toHaveBeenCalledTimes(1);
    expect(authorizeFsPath).toHaveBeenCalledWith('/vault/empty', 'root');
  });
});
