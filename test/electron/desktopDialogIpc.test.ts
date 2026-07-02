import { describe, expect, it, vi } from 'vitest';
import { registerDesktopDialogIpc } from '../../electron/desktopDialogIpc.mjs';
import { __testing__ as externalDialogTesting } from '../../electron/externalFileDialog.mjs';

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
      filePaths: ['/notesRoot/docs/a.md'],
    });

    await expect(handlers.get('desktop:dialog:open')?.({}, {
      authorizeParentDirectory: true,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })).resolves.toBe('/notesRoot/docs/a.md');

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(undefined, {
      title: undefined,
      defaultPath: undefined,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      properties: ['openFile'],
    });
    expect(authorizeFsPath).toHaveBeenCalledWith('/notesRoot/docs/a.md', 'file');
    expect(authorizeFsPath).toHaveBeenCalledWith('/notesRoot/docs', 'root');
    expect(authorizeFsPath).toHaveBeenCalledWith('/notesRoot', 'watch-root');
  });

  it('authorizes selected folders as roots without file filters', async () => {
    const { handlers, dialog, authorizeFsPath } = registerHarness();
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/notesRoot/empty'],
    });

    await expect(handlers.get('desktop:dialog:open')?.({}, {
      directory: true,
      defaultPath: '/notesRoot',
    })).resolves.toBe('/notesRoot/empty');

    expect(dialog.showOpenDialog).toHaveBeenCalledWith(undefined, {
      title: undefined,
      defaultPath: '/notesRoot',
      filters: undefined,
      properties: ['openDirectory'],
    });
    expect(authorizeFsPath).toHaveBeenCalledTimes(1);
    expect(authorizeFsPath).toHaveBeenCalledWith('/notesRoot/empty', 'root');
  });

  it('builds zenity arguments for directory and markdown file pickers', () => {
    expect(externalDialogTesting.buildExternalOpenDialogArgs({ command: 'zenity' }, {
      directory: true,
      multiple: false,
      title: 'Open Folder',
      defaultPath: '/notesRoot',
    })).toEqual([
      '--file-selection',
      '--separator=\n',
      '--title',
      'Open Folder',
      '--filename',
      '/notesRoot',
      '--directory',
    ]);

    expect(externalDialogTesting.buildExternalOpenDialogArgs({ command: 'zenity' }, {
      multiple: true,
      filters: [{ name: 'Markdown', extensions: ['md', '.markdown'] }],
    })).toEqual([
      '--file-selection',
      '--separator=\n',
      '--multiple',
      '--file-filter',
      'Markdown | *.md *.markdown',
    ]);
  });

  it('builds kdialog arguments and parses multi-selection output', () => {
    expect(externalDialogTesting.buildExternalOpenDialogArgs({ command: 'kdialog' }, {
      multiple: true,
      defaultPath: '/notesRoot',
      filters: [{ name: 'Images', extensions: ['png', 'jpg'] }],
    })).toEqual([
      '--multiple',
      '--separate-output',
      '--getopenfilename',
      '/notesRoot',
      'Images | *.png *.jpg',
    ]);

    expect(externalDialogTesting.parseExternalDialogPaths('/a.md\n/b.md\n', { multiple: true })).toEqual([
      '/a.md',
      '/b.md',
    ]);
    expect(externalDialogTesting.parseExternalDialogPaths('/a.md\n/b.md\n', { multiple: false })).toEqual(['/a.md']);
  });
});
