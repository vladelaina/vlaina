import path from 'node:path';

export function registerDesktopDialogIpc({
  app,
  dialog,
  handleIpc,
  resolveTargetWindow,
  authorizeFsPath,
}) {
  handleIpc('desktop:dialog:open', async (event, options) => {
    const window = resolveTargetWindow(event);
    const properties = [];

    if (options?.directory) {
      properties.push('openDirectory');
    } else {
      properties.push('openFile');
    }

    if (options?.multiple) {
      properties.push('multiSelections');
    }

    const dialogOptions = {
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      properties,
    };

    const result = await dialog.showOpenDialog(window ?? undefined, dialogOptions);

    if (result.canceled) {
      return null;
    }

    if (options?.multiple) {
      await Promise.all(result.filePaths.map((filePath) => (
        authorizeOpenDialogPath(filePath, options, authorizeFsPath)
      )));
      return result.filePaths;
    }

    const selectedPath = result.filePaths[0] ?? null;
    if (selectedPath) {
      await authorizeOpenDialogPath(selectedPath, options, authorizeFsPath);
    }

    return selectedPath;
  });

  handleIpc('desktop:dialog:save', async (event, options) => {
    const window = resolveTargetWindow(event);
    const result = await dialog.showSaveDialog(window ?? undefined, {
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    if (result.canceled || !result.filePath) {
      return null;
    }

    await authorizeFsPath(result.filePath, 'file');
    if (options?.authorizeParentDirectory) {
      const parentPath = path.dirname(result.filePath);
      const watchParentPath = path.dirname(parentPath);
      await authorizeFsPath(parentPath, 'root');
      await authorizeFsPath(watchParentPath, 'watch-root');
    }
    return result.filePath;
  });

  handleIpc('desktop:dialog:message', async (event, message, options) => {
    const window = resolveTargetWindow(event);
    await dialog.showMessageBox(window ?? undefined, {
      type: options?.kind ?? 'info',
      title: options?.title,
      message,
    });
  });

  handleIpc('desktop:dialog:confirm', async (event, message, options) => {
    const window = resolveTargetWindow(event);
    const result = await dialog.showMessageBox(window ?? undefined, {
      type: options?.kind ?? 'question',
      title: options?.title,
      message,
      buttons: ['OK', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });

    return result.response === 0;
  });
}

async function authorizeOpenDialogPath(filePath, options, authorizeFsPath) {
  if (options?.directory) {
    await authorizeFsPath(filePath, 'root');
    return {};
  }

  await authorizeFsPath(filePath, 'file');
  if (options?.authorizeParentDirectory) {
    const parentPath = path.dirname(filePath);
    const watchParentPath = path.dirname(parentPath);
    await authorizeFsPath(parentPath, 'root');
    await authorizeFsPath(watchParentPath, 'watch-root');
  }

  return {};
}
