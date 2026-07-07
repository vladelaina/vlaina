export function installDevelopmentParentProcessGuard(app) {
  if (app.isPackaged) {
    return;
  }

  const parentPid = process.ppid;
  if (!parentPid || parentPid <= 1) {
    return;
  }

  const interval = setInterval(() => {
    if (process.ppid === parentPid && process.ppid > 1) {
      return;
    }

    app.quit();
    setTimeout(() => app.exit(0), 1000).unref?.();
  }, 1000);

  interval.unref?.();
}

export function configureDefaultSessionSafely(session) {
  try {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(() => false);
  } catch (error) {
  }
}
