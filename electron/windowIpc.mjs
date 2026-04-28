import electron from 'electron';

const { BrowserWindow } = electron;

export function registerWindowIpc({
  closeApprovedWebContents,
  createWindow,
  getWindowLabel,
  handleIpc,
  resolveTargetWindow,
}) {
  handleIpc('desktop:get-platform', () => 'electron');

  handleIpc('desktop:window:minimize', (event) => {
    resolveTargetWindow(event)?.minimize();
  });

  handleIpc('desktop:window:maximize-toggle', (event) => {
    const window = resolveTargetWindow(event);
    if (!window) return false;

    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }

    window.maximize();
    return true;
  });

  handleIpc('desktop:window:close', (event) => {
    resolveTargetWindow(event)?.close();
  });

  handleIpc('desktop:window:confirm-close', (event) => {
    const window = resolveTargetWindow(event);
    if (!window) return;

    closeApprovedWebContents.add(window.webContents.id);
    window.close();
  });

  handleIpc('desktop:window:is-maximized', (event) => {
    return resolveTargetWindow(event)?.isMaximized() ?? false;
  });

  handleIpc('desktop:window:set-resizable', (event, resizable) => {
    resolveTargetWindow(event)?.setResizable(Boolean(resizable));
  });

  handleIpc('desktop:window:set-maximizable', (event, maximizable) => {
    resolveTargetWindow(event)?.setMaximizable(Boolean(maximizable));
  });

  handleIpc('desktop:window:set-min-size', (event, width, height) => {
    resolveTargetWindow(event)?.setMinimumSize(width, height);
  });

  handleIpc('desktop:window:set-size', (event, width, height) => {
    resolveTargetWindow(event)?.setSize(width, height);
  });

  handleIpc('desktop:window:center', (event) => {
    resolveTargetWindow(event)?.center();
  });

  handleIpc('desktop:window:get-size', (event) => {
    const window = resolveTargetWindow(event);
    if (!window) {
      return { width: 0, height: 0 };
    }

    const [width, height] = window.getSize();
    return { width, height };
  });

  handleIpc('desktop:window:get-label', (event) => {
    const window = resolveTargetWindow(event);
    return window ? getWindowLabel(window) : null;
  });

  handleIpc('desktop:window:focus', (_event, label) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (getWindowLabel(window) === label) {
        window.focus();
        return true;
      }
    }

    return false;
  });

  handleIpc('desktop:window:toggle-fullscreen', (event) => {
    const window = resolveTargetWindow(event);
    if (!window) return false;

    const next = !window.isFullScreen();
    window.setFullScreen(next);
    return next;
  });

  handleIpc('desktop:window:create', (_event, windowOptions) => {
    const vaultPath =
      typeof windowOptions?.vaultPath === 'string' && windowOptions.vaultPath.trim()
        ? windowOptions.vaultPath
        : null;
    const notePath =
      typeof windowOptions?.notePath === 'string' && windowOptions.notePath.trim()
        ? windowOptions.notePath
        : null;
    const viewMode =
      typeof windowOptions?.viewMode === 'string' && windowOptions.viewMode.trim()
        ? windowOptions.viewMode
        : null;

    createWindow({
      newWindow: true,
      vaultPath,
      notePath,
      viewMode,
    });
  });
}
