import electron from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerWindowIpc as registerWindowIpcHandlers } from './windowIpc.mjs';

const { BrowserWindow } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createWindowManager({
  rendererDevUrl,
  appIconPath,
  isDevelopment,
  openExternalIfAllowed,
  isTrustedRendererUrl,
}) {
  const closeApprovedWebContents = new Set();
  const windowLabels = new Map();
  let secondaryWindowCounter = 0;

  function buildRendererUrl(windowOptions = {}) {
    const url = new URL(rendererDevUrl);
    const params = new URLSearchParams();

    params.set('newWindow', 'true');

    if (windowOptions.vaultPath) {
      params.set('vaultPath', windowOptions.vaultPath);
    }

    if (windowOptions.notePath) {
      params.set('notePath', windowOptions.notePath);
    }

    if (windowOptions.viewMode) {
      params.set('viewMode', windowOptions.viewMode);
    }

    url.search = params.toString();
    return url.toString();
  }

  function getWindowLabel(window) {
    return windowLabels.get(window.id) ?? 'main';
  }

  function isUsableWindow(window) {
    return window && !window.isDestroyed() && !window.webContents.isDestroyed();
  }

  function resolveTargetWindow(event) {
    if (event?.sender && !event.sender.isDestroyed()) {
      const fromSender = BrowserWindow.fromWebContents(event.sender);
      if (isUsableWindow(fromSender)) {
        return fromSender;
      }
    }

    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (isUsableWindow(focusedWindow)) {
      return focusedWindow;
    }

    return BrowserWindow.getAllWindows().find(isUsableWindow) ?? null;
  }

  async function loadRenderer(window, windowOptions = {}) {
    if (isDevelopment()) {
      await window.loadURL(
        windowOptions.newWindow ? buildRendererUrl(windowOptions) : rendererDevUrl
      );
      return;
    }

    const rendererFile = path.join(__dirname, '..', 'dist', 'index.html');

    if (windowOptions.newWindow) {
      await window.loadFile(rendererFile, {
        search: new URLSearchParams({
          newWindow: 'true',
          ...(windowOptions.vaultPath ? { vaultPath: windowOptions.vaultPath } : {}),
          ...(windowOptions.notePath ? { notePath: windowOptions.notePath } : {}),
          ...(windowOptions.viewMode ? { viewMode: windowOptions.viewMode } : {}),
        }).toString(),
      });
      return;
    }

    await window.loadFile(rendererFile);
  }

  function attachWindowLifecycle(window) {
    const webContentsId = window.webContents.id;
    window.on('closed', () => {
      closeApprovedWebContents.delete(webContentsId);
      windowLabels.delete(window.id);
    });

    window.webContents.on('before-input-event', (event, input) => {
      const isOpenMarkdownShortcut =
        input.type === 'keyDown' &&
        (input.control || input.meta) &&
        !input.shift &&
        !input.alt &&
        input.key.toLowerCase() === 'o';

      if (isOpenMarkdownShortcut) {
        event.preventDefault();
        window.webContents.send('desktop:shortcut:open-markdown-file');
        return;
      }

      const isDevToolsShortcut =
        isDevelopment() &&
        input.type === 'keyDown' &&
        (
          input.key === 'F12' ||
          ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')
        );

      if (isDevToolsShortcut) {
        event.preventDefault();

        if (window.webContents.isDevToolsOpened()) {
          window.webContents.closeDevTools();
          return;
        }

        window.webContents.openDevTools({ mode: 'detach' });
      }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      openExternalIfAllowed(url);
      return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, url) => {
      if (isTrustedRendererUrl(url)) {
        return;
      }

      event.preventDefault();
      openExternalIfAllowed(url);
    });

    window.webContents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });

    window.on('close', (event) => {
      if (window.webContents.isDestroyed()) {
        return;
      }

      if (closeApprovedWebContents.has(webContentsId)) {
        closeApprovedWebContents.delete(webContentsId);
        return;
      }

      event.preventDefault();
      window.webContents.send('desktop:window:close-requested');
    });
  }

  function createWindow(windowOptions = {}) {
    const label = windowOptions.label ?? (secondaryWindowCounter === 0 ? 'main' : `window-${secondaryWindowCounter}`);
    secondaryWindowCounter += 1;

    const window = new BrowserWindow({
      width: 980,
      height: 640,
      minWidth: 400,
      minHeight: 300,
      center: true,
      icon: appIconPath,
      backgroundColor: '#FFFFFFFF',
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        spellcheck: false,
      },
    });

    windowLabels.set(window.id, label);
    attachWindowLifecycle(window);

    loadRenderer(window, windowOptions).catch((error) => {
      console.error('[electron] Failed to load renderer:', error);
    });

    return window;
  }

  function createMainWindow() {
    return createWindow({ label: 'main' });
  }

  function hasOpenWindows() {
    return BrowserWindow.getAllWindows().length > 0;
  }

  function registerWindowIpc(handleIpc) {
    registerWindowIpcHandlers({
      closeApprovedWebContents,
      createWindow,
      getWindowLabel,
      handleIpc,
      resolveTargetWindow,
    });
  }

  return {
    createMainWindow,
    hasOpenWindows,
    registerWindowIpc,
    resolveTargetWindow,
  };
}
