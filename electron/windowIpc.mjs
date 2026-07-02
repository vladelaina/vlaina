import electron from 'electron';

const { BrowserWindow } = electron;

const MIN_WINDOW_DIMENSION = 1;
const MAX_WINDOW_DIMENSION = 8192;
const MAX_WINDOW_DIMENSION_INPUT_CHARS = 64;
const CSS_COLOR_PATTERN = /^(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)$/;
const MAX_CSS_COLOR_CHARS = 80;

function normalizeCssColor(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a CSS color string.`);
  }

  const color = value.trim();
  if (color.length === 0 || color.length > MAX_CSS_COLOR_CHARS || !CSS_COLOR_PATTERN.test(color)) {
    throw new Error(`${label} must be a safe CSS color string.`);
  }
  return color;
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

export function normalizeWindowDimension(value, label) {
  const dimension = readFiniteWindowDimension(value);
  if (dimension === null) {
    throw new Error(`A finite ${label} is required.`);
  }

  return Math.min(
    MAX_WINDOW_DIMENSION,
    Math.max(MIN_WINDOW_DIMENSION, Math.round(dimension)),
  );
}

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
    resolveTargetWindow(event)?.setMinimumSize(
      normalizeWindowDimension(width, 'minimum window width'),
      normalizeWindowDimension(height, 'minimum window height'),
    );
  });

  handleIpc('desktop:window:set-size', (event, width, height) => {
    resolveTargetWindow(event)?.setSize(
      normalizeWindowDimension(width, 'window width'),
      normalizeWindowDimension(height, 'window height'),
    );
  });

  handleIpc('desktop:window:set-theme-colors', (event, colors) => {
    const window = resolveTargetWindow(event);
    if (!window) return false;

    const backgroundColor = normalizeCssColor(colors?.backgroundColor, 'background color');
    const titleBarOverlayColor = normalizeCssColor(colors?.titleBarOverlayColor, 'titlebar overlay color');
    const titleBarSymbolColor = normalizeCssColor(colors?.titleBarSymbolColor, 'titlebar symbol color');

    window.setBackgroundColor(backgroundColor);
    if (process.platform === 'win32') {
      window.setTitleBarOverlay({
        color: titleBarOverlayColor,
        symbolColor: titleBarSymbolColor,
        height: 40,
      });
    }
    return true;
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
        if (window.isMinimized()) {
          window.restore();
        }
        window.show();
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
    const notesRootPath =
      typeof windowOptions?.notesRootPath === 'string' && windowOptions.notesRootPath.trim()
        ? windowOptions.notesRootPath
        : null;
    const notePath =
      typeof windowOptions?.notePath === 'string' && windowOptions.notePath.trim()
        ? windowOptions.notePath
        : null;
    const folderPath =
      typeof windowOptions?.folderPath === 'string' && windowOptions.folderPath.trim()
        ? windowOptions.folderPath
        : null;
    const chatSessionId =
      typeof windowOptions?.chatSessionId === 'string' && windowOptions.chatSessionId.trim()
        ? windowOptions.chatSessionId
        : null;
    const viewMode =
      typeof windowOptions?.viewMode === 'string' && windowOptions.viewMode.trim()
        ? windowOptions.viewMode
        : null;

    createWindow({
      newWindow: true,
      notesRootPath,
      notePath,
      folderPath,
      chatSessionId,
      viewMode,
    });
  });
}
