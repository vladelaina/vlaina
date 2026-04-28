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

    logDesktopDialog(app, 'open:start', {
      options: dialogOptions,
      hasWindow: Boolean(window),
      windowId: window?.id ?? null,
      platform: process.platform,
      sessionType: process.env.XDG_SESSION_TYPE ?? null,
      desktop: process.env.XDG_CURRENT_DESKTOP ?? process.env.DESKTOP_SESSION ?? null,
      portalDesktop: process.env.XDG_DESKTOP_PORTAL_DIR ?? null,
    });

    const result = await showLoggedOpenDialog(app, dialog, window, dialogOptions);

    if (result.canceled) {
      return null;
    }

    if (options?.multiple) {
      const kind = options?.directory ? 'root' : 'file';
      await Promise.all(result.filePaths.flatMap((filePath) => {
        const authorizations = [authorizeFsPath(filePath, kind)];
        if (!options?.directory && options?.authorizeParentDirectory) {
          const parentPath = path.dirname(filePath);
          authorizations.push(authorizeFsPath(parentPath, 'root'));
          authorizations.push(authorizeFsPath(path.dirname(parentPath), 'watch-root'));
        }
        return authorizations;
      }));
      return result.filePaths;
    }

    const selectedPath = result.filePaths[0] ?? null;
    if (selectedPath) {
      await authorizeFsPath(selectedPath, options?.directory ? 'root' : 'file');
      if (!options?.directory && options?.authorizeParentDirectory) {
        const parentPath = path.dirname(selectedPath);
        const watchParentPath = path.dirname(parentPath);
        await authorizeFsPath(parentPath, 'root');
        await authorizeFsPath(watchParentPath, 'watch-root');
        logDesktopDialog(app, 'open:authorized_parent', {
          selectedPath,
          parentPath,
          watchParentPath,
        });
      }
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

async function showLoggedOpenDialog(app, dialog, window, dialogOptions) {
  try {
    const result = await dialog.showOpenDialog(window ?? undefined, dialogOptions);
    logDesktopDialog(app, 'open:result', {
      canceled: result.canceled,
      filePathCount: result.filePaths.length,
      filePaths: result.filePaths,
    });
    return result;
  } catch (error) {
    logDesktopDialog(app, 'open:error', {
      message: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : null,
    });
    throw error;
  }
}

function logDesktopDialog(app, event, details = {}) {
  if (app.isPackaged && process.env.VLAINA_DESKTOP_DIALOG_DEBUG !== '1') {
    return;
  }

  console.info(`[desktop dialog] ${event}`, details);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
