import path from 'node:path';

export function createMarkdownOpenController({
  BrowserWindow,
  authorizeFsPath,
  createMainWindow,
  isReadyToReveal,
  normalizeMarkdownOpenPath,
}) {
  let pendingOpenMarkdownPath = null;

  async function authorizeMarkdownOpenPath(filePath) {
    await authorizeFsPath(filePath, 'file');

    const parentPath = path.dirname(filePath);
    await authorizeFsPath(parentPath, 'root');
    await authorizeFsPath(path.dirname(parentPath), 'watch-root');
  }

  function focusWindow(window, { forceShow = false } = {}) {
    if (!window || window.isDestroyed()) {
      return;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    if (forceShow || isReadyToReveal(window)) {
      window.show();
      window.focus();
    }
  }

  function showMainWindow() {
    const existingWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
    const window = existingWindow ?? createMainWindow();

    focusWindow(window, { forceShow: Boolean(existingWindow) });
  }

  function findMarkdownPathInArgv(argv) {
    for (const value of Array.isArray(argv) ? argv : []) {
      const filePath = normalizeMarkdownOpenPath(value);
      if (filePath) {
        return filePath;
      }
    }

    return null;
  }

  function sendOpenMarkdownShortcut(window, { waitForStartupReady = false } = {}) {
    if (!window || window.isDestroyed()) {
      return false;
    }

    const send = () => {
      if (window.isDestroyed()) return;
      window.webContents.send('desktop:shortcut:open-markdown-file');
    };

    if (waitForStartupReady && !isReadyToReveal(window)) {
      const handleStartupReady = (_event, channel) => {
        if (channel !== 'desktop:startup-ready') {
          return;
        }

        window.webContents.off?.('ipc-message', handleStartupReady);
        send();
      };
      window.webContents.on('ipc-message', handleStartupReady);
      return true;
    }

    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', send);
    } else {
      send();
    }

    return true;
  }

  function requestOpenMarkdownFile() {
    const existingWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
    const window = existingWindow ?? createMainWindow();
    focusWindow(window, { forceShow: Boolean(existingWindow) });
    return sendOpenMarkdownShortcut(window, { waitForStartupReady: !existingWindow });
  }

  async function sendOpenMarkdownPath(window, filePath) {
    const normalizedPath = normalizeMarkdownOpenPath(filePath);
    if (!window || window.isDestroyed() || !normalizedPath) {
      return false;
    }

    try {
      await authorizeMarkdownOpenPath(normalizedPath);
    } catch {
      return false;
    }

    const send = () => {
      if (window.isDestroyed()) return;
      window.webContents.send('desktop:app:open-markdown-file', normalizedPath);
    };

    if (window.webContents.isLoading()) {
      window.webContents.once('did-finish-load', send);
    } else {
      send();
    }

    return true;
  }

  async function openMarkdownPath(filePath) {
    const normalizedPath = normalizeMarkdownOpenPath(filePath);
    if (!normalizedPath) {
      return false;
    }

    try {
      await authorizeMarkdownOpenPath(normalizedPath);
    } catch {
      return false;
    }

    const existingWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
    if (!existingWindow) {
      pendingOpenMarkdownPath = normalizedPath;
      return false;
    }

    focusWindow(existingWindow, { forceShow: true });
    pendingOpenMarkdownPath = null;
    return await sendOpenMarkdownPath(existingWindow, normalizedPath);
  }

  async function flushPendingOpenMarkdownPath(window) {
    if (!pendingOpenMarkdownPath) {
      return;
    }
    await sendOpenMarkdownPath(window, pendingOpenMarkdownPath);
    pendingOpenMarkdownPath = null;
  }

  return {
    findMarkdownPathInArgv,
    flushPendingOpenMarkdownPath,
    openMarkdownPath,
    requestOpenMarkdownFile,
    setPendingOpenMarkdownPath: (filePath) => {
      pendingOpenMarkdownPath = filePath;
    },
    showMainWindow,
  };
}
