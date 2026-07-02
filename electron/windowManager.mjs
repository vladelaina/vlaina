import electron from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerWindowIpc as registerWindowIpcHandlers } from './windowIpc.mjs';

const { app, BrowserWindow, screen } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_WINDOW_BOUNDS = Object.freeze({ width: 980, height: 640 });
const MIN_RESTORED_WINDOW_WIDTH = 800;
const MIN_RESTORED_WINDOW_HEIGHT = 600;
const MAX_RESTORED_WINDOW_WIDTH = 8192;
const MAX_RESTORED_WINDOW_HEIGHT = 8192;
const MAX_WINDOW_DIMENSION_INPUT_CHARS = 64;
const WINDOW_STATE_WRITE_DELAY_MS = 250;
const MAX_WINDOW_STATE_JSON_BYTES = 64 * 1024;

function getWindowStatePath() {
  return path.join(app.getPath('userData'), '.vlaina', 'app', 'window', 'state.json');
}

function readFiniteWindowDimension(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.length <= MAX_WINDOW_DIMENSION_INPUT_CHARS) {
    const trimmed = value.trim();
    if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function normalizeStoredWindowBounds(bounds) {
  const widthValue = readFiniteWindowDimension(bounds?.width);
  const heightValue = readFiniteWindowDimension(bounds?.height);
  if (widthValue === null || heightValue === null) {
    return null;
  }

  const width = Math.round(widthValue);
  const height = Math.round(heightValue);
  return {
    width: Math.min(MAX_RESTORED_WINDOW_WIDTH, Math.max(MIN_RESTORED_WINDOW_WIDTH, width)),
    height: Math.min(MAX_RESTORED_WINDOW_HEIGHT, Math.max(MIN_RESTORED_WINDOW_HEIGHT, height)),
  };
}

function clampWindowBoundsToCurrentDisplay(bounds) {
  try {
    const workAreaSize = screen?.getPrimaryDisplay?.()?.workAreaSize;
    const workAreaWidth = readFiniteWindowDimension(workAreaSize?.width);
    const workAreaHeight = readFiniteWindowDimension(workAreaSize?.height);
    if (workAreaWidth === null || workAreaHeight === null) {
      return bounds;
    }
    const maxWidth = Math.max(MIN_RESTORED_WINDOW_WIDTH, Math.round(workAreaWidth));
    const maxHeight = Math.max(MIN_RESTORED_WINDOW_HEIGHT, Math.round(workAreaHeight));

    return {
      width: Math.min(bounds.width, maxWidth),
      height: Math.min(bounds.height, maxHeight),
    };
  } catch {
    return bounds;
  }
}

export function readStoredWindowState() {
  try {
    const statePath = getWindowStatePath();
    const stats = fs.statSync(statePath);
    if (!stats.isFile() || stats.size > MAX_WINDOW_STATE_JSON_BYTES) {
      return null;
    }

    const content = fs.readFileSync(statePath, 'utf8');
    if (Buffer.byteLength(content, 'utf8') > MAX_WINDOW_STATE_JSON_BYTES) {
      return null;
    }

    const payload = JSON.parse(content);
    const bounds = normalizeStoredWindowBounds(payload?.bounds);
    if (!bounds) {
      return null;
    }

    return {
      bounds,
      isMaximized: Boolean(payload?.isMaximized),
    };
  } catch {
    return null;
  }
}

function writeStoredWindowState(state) {
  let tempStatePath = null;
  try {
    const statePath = getWindowStatePath();
    tempStatePath = `${statePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(tempStatePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(tempStatePath, statePath);
  } catch (error) {
    if (tempStatePath) {
      try {
        fs.rmSync(tempStatePath, { force: true });
      } catch {
      }
    }
    console.warn('[vlaina] Failed to persist window state:', error);
  }
}

function captureWindowState(window) {
  const bounds = window.isMaximized() || window.isFullScreen?.() || window.isMinimized?.()
    ? window.getNormalBounds()
    : window.getBounds();
  const normalizedBounds = normalizeStoredWindowBounds(bounds);
  if (!normalizedBounds) {
    return null;
  }

  return {
    bounds: normalizedBounds,
    isMaximized: window.isMaximized(),
  };
}

export function createWindowManager({
  rendererDevUrl,
  appIconPath,
  isDevelopment,
  openExternalIfAllowed,
  isTrustedRendererUrl,
  reportError = () => {},
}) {
  const closeApprovedWebContents = new Set();
  const readyToRevealWebContents = new Set();
  const windowLabels = new Map();
  let secondaryWindowCounter = 1;
  let persistedWindowState = readStoredWindowState();
  const DEV_RENDERER_RELOAD_DELAY_MS = 1000;
  const DEV_RENDERER_RELOAD_MAX_DELAY_MS = 8000;

  function buildRendererUrl(windowOptions = {}) {
    const url = new URL(rendererDevUrl);
    const params = new URLSearchParams();

    params.set('newWindow', 'true');

    if (windowOptions.notesRootPath) {
      params.set('notesRootPath', windowOptions.notesRootPath);
    }

    if (windowOptions.notePath) {
      params.set('notePath', windowOptions.notePath);
    }

    if (windowOptions.folderPath) {
      params.set('folderPath', windowOptions.folderPath);
    }

    if (windowOptions.chatSessionId) {
      params.set('chatSessionId', windowOptions.chatSessionId);
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

  function safeSend(window, channel, payload) {
    if (!isUsableWindow(window)) {
      return false;
    }

    try {
      window.webContents.send(channel, payload);
      return true;
    } catch {
      return false;
    }
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
    if (!isUsableWindow(window)) {
      return;
    }

    if (isDevelopment()) {
      const url = windowOptions.newWindow ? buildRendererUrl(windowOptions) : rendererDevUrl;
      await window.loadURL(url);
      return;
    }

    const rendererFile = path.join(__dirname, '..', 'dist', 'index.html');

    if (windowOptions.newWindow) {
      await window.loadFile(rendererFile, {
        search: new URLSearchParams({
          newWindow: 'true',
          ...(windowOptions.notesRootPath ? { notesRootPath: windowOptions.notesRootPath } : {}),
          ...(windowOptions.notePath ? { notePath: windowOptions.notePath } : {}),
          ...(windowOptions.folderPath ? { folderPath: windowOptions.folderPath } : {}),
          ...(windowOptions.chatSessionId ? { chatSessionId: windowOptions.chatSessionId } : {}),
          ...(windowOptions.viewMode ? { viewMode: windowOptions.viewMode } : {}),
        }).toString(),
      });
      return;
    }

    await window.loadFile(rendererFile);
  }

  function attachWindowLifecycle(window, windowOptions = {}) {
    const webContentsId = window.webContents.id;
    let externalOpenModifierActive = false;
    let didRevealWindow = false;
    let didBrowserWindowReportReadyToShow = false;
    let didRendererReportStartupReady = false;
    let devRendererReloadTimer = null;
    let devRendererReloadDelay = DEV_RENDERER_RELOAD_DELAY_MS;
    let windowStateWriteTimer = null;

    const clearDevRendererReloadTimer = () => {
      if (devRendererReloadTimer === null) {
        return;
      }

      clearTimeout(devRendererReloadTimer);
      devRendererReloadTimer = null;
    };

    const clearWindowStateWriteTimer = () => {
      if (windowStateWriteTimer === null) {
        return;
      }

      clearTimeout(windowStateWriteTimer);
      windowStateWriteTimer = null;
    };

    const persistWindowState = () => {
      clearWindowStateWriteTimer();
      if (!isUsableWindow(window)) {
        return;
      }

      if (getWindowLabel(window) !== 'main') {
        return;
      }

      const state = captureWindowState(window);
      if (!state) {
        return;
      }

      persistedWindowState = state;
      writeStoredWindowState(state);
    };

    const scheduleWindowStateWrite = () => {
      clearWindowStateWriteTimer();
      if (!isUsableWindow(window)) {
        return;
      }

      if (getWindowLabel(window) !== 'main') {
        return;
      }

      windowStateWriteTimer = setTimeout(() => {
        windowStateWriteTimer = null;
        persistWindowState();
      }, WINDOW_STATE_WRITE_DELAY_MS);
    };

    const scheduleDevRendererReload = (reason) => {
      if (!isDevelopment() || window.isDestroyed()) {
        return;
      }

      if (devRendererReloadTimer !== null) {
        return;
      }

      const delay = devRendererReloadDelay;
      devRendererReloadDelay = Math.min(devRendererReloadDelay * 2, DEV_RENDERER_RELOAD_MAX_DELAY_MS);
      console.warn(`[vlaina] Renderer unavailable in development (${reason}); retrying in ${delay}ms`);

      devRendererReloadTimer = setTimeout(() => {
        devRendererReloadTimer = null;
        if (!isUsableWindow(window)) {
          return;
        }

        loadRenderer(window, windowOptions).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          scheduleDevRendererReload(`load failed: ${message}`);
        });
      }, delay);
    };

    const revealWindow = () => {
      if (didRevealWindow || window.isDestroyed()) {
        return;
      }

      didRevealWindow = true;
      readyToRevealWebContents.add(webContentsId);
      window.show();

      if (windowOptionsShouldFocusOnReveal(window, windowOptions)) {
        window.focus();
      }
    };

    const revealWindowWhenReady = ({ allowWithoutReadyToShow = false } = {}) => {
      if (!didRendererReportStartupReady) {
        return;
      }

      if (!didBrowserWindowReportReadyToShow && !allowWithoutReadyToShow) {
        return;
      }

      revealWindow();
    };

    window.once('ready-to-show', () => {
      didBrowserWindowReportReadyToShow = true;
      revealWindowWhenReady();
    });
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => revealWindowWhenReady({ allowWithoutReadyToShow: true }), 3000);
    });

    window.webContents.on('did-finish-load', () => {
      clearDevRendererReloadTimer();
      devRendererReloadDelay = DEV_RENDERER_RELOAD_DELAY_MS;
    });

    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }

      const summary = `${errorCode} ${errorDescription || 'unknown error'}`;
      if (isDevelopment() && isTrustedRendererUrl(validatedURL || rendererDevUrl)) {
        scheduleDevRendererReload(summary);
        return;
      }

      reportError(new Error(`Renderer failed to load: ${summary}`), {
        label: getWindowLabel(window),
        validatedURL: validatedURL || '',
      });
      console.error(`[vlaina] Renderer failed to load: ${summary}`);
    });

    window.webContents.on('render-process-gone', (_event, details) => {
      const reason = details?.reason ?? 'unknown';
      const exitCode = details?.exitCode ?? 'unknown';
      reportError(new Error(`Renderer process gone (${reason}, exitCode ${exitCode})`), {
        label: getWindowLabel(window),
        reason,
        exitCode,
      });
      console.error(`[vlaina] Renderer process gone (${reason}, exitCode ${exitCode})`);

      if (!isUsableWindow(window)) {
        return;
      }

      if (isDevelopment()) {
        scheduleDevRendererReload(`renderer process gone: ${reason}`);
        return;
      }

      window.reload();
    });

    window.on('unresponsive', () => {
      console.warn(`[vlaina] Window became unresponsive (${getWindowLabel(window)})`);
    });

    window.webContents.on('ipc-message', (_event, channel) => {
      if (channel !== 'desktop:startup-ready') {
        return;
      }

      didRendererReportStartupReady = true;
      revealWindowWhenReady();
    });

    window.on('closed', () => {
      clearDevRendererReloadTimer();
      clearWindowStateWriteTimer();
      closeApprovedWebContents.delete(webContentsId);
      readyToRevealWebContents.delete(webContentsId);
      windowLabels.delete(window.id);
    });

    window.on('resize', scheduleWindowStateWrite);
    window.on('maximize', scheduleWindowStateWrite);
    window.on('unmaximize', scheduleWindowStateWrite);
    window.on('close', persistWindowState);

    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        externalOpenModifierActive = Boolean(input.control || input.meta);
      } else if (
        input.type === 'keyUp' &&
        (input.key === 'Control' || input.key === 'Meta' || input.key === 'Super')
      ) {
        externalOpenModifierActive = false;
      }

      const isOpenMarkdownShortcut =
        input.type === 'keyDown' &&
        (input.control || input.meta) &&
        !input.shift &&
        !input.alt &&
        input.key.toLowerCase() === 'o';

      if (isOpenMarkdownShortcut) {
        event.preventDefault();
        safeSend(window, 'desktop:shortcut:open-markdown-file');
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
      if (externalOpenModifierActive) {
        openExternalIfAllowed(url);
      }
      return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, url) => {
      if (isTrustedRendererUrl(url)) {
        return;
      }

      event.preventDefault();
      if (externalOpenModifierActive) {
        openExternalIfAllowed(url);
      }
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
      safeSend(window, 'desktop:window:close-requested');
    });

    if (windowOptions.newWindow) {
      revealWindow();
    }

    return {
      scheduleDevRendererReload,
    };
  }

  function windowOptionsShouldFocusOnReveal(window, windowOptions = {}) {
    return Boolean(windowOptions.newWindow) || windowLabels.get(window.id) === 'main' || !BrowserWindow.getFocusedWindow();
  }

  function createWindow(windowOptions = {}) {
    const label = windowOptions.label ?? (windowOptions.newWindow ? `window-${secondaryWindowCounter++}` : 'main');
    const restoredBounds = clampWindowBoundsToCurrentDisplay(persistedWindowState?.bounds ?? DEFAULT_WINDOW_BOUNDS);

    const window = new BrowserWindow({
      width: restoredBounds.width,
      height: restoredBounds.height,
      minWidth: 400,
      minHeight: 300,
      center: true,
      icon: appIconPath,
      backgroundColor: '#FFFFFFFF',
      show: false,
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

    if (label === 'main' && persistedWindowState?.isMaximized) {
      window.maximize();
    }

    windowLabels.set(window.id, label);
    const { scheduleDevRendererReload } = attachWindowLifecycle(window, windowOptions);

    loadRenderer(window, windowOptions).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (isDevelopment()) {
        console.warn(`[vlaina] Initial renderer load failed: ${message}`);
        scheduleDevRendererReload(`initial load failed: ${message}`);
        return;
      }

      reportError(new Error(`Initial renderer load failed: ${message}`), {
        label: getWindowLabel(window),
      });
      console.error(`[vlaina] Initial renderer load failed: ${message}`);
    });

    return window;
  }

  function createMainWindow() {
    return createWindow({ label: 'main' });
  }

  function hasOpenWindows() {
    return BrowserWindow.getAllWindows().length > 0;
  }

  function isReadyToReveal(window) {
    return readyToRevealWebContents.has(window.webContents.id);
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
    isReadyToReveal,
    registerWindowIpc,
    resolveTargetWindow,
  };
}
