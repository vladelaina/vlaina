import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { watch } from 'node:fs';
import { createServer } from 'node:http';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererDevUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:3000';
const apiBaseUrl = (process.env.APP_API_BASE_URL ?? 'https://api.vlaina.com').trim().replace(/\/+$/, '');
const managedApiBaseUrl = `${apiBaseUrl}/v1`;
const appSessionHeader = 'x-app-session-token';
const loopbackCallbackPath = '/oauth/callback';
const appIconPath = path.join(__dirname, '..', 'public', 'logo.png');
const closeApprovedWebContents = new Set();
const windowLabels = new Map();
const activeWatchers = new Map();
const activeManagedStreams = new Map();
let secondaryWindowCounter = 0;
let watcherCounter = 0;

async function readSecretsStore() {
  const secretsDir = path.join(app.getPath('userData'), '.vlaina', 'secrets');
  const secretsPath = path.join(secretsDir, 'ai-provider-secrets.json');

  await mkdir(secretsDir, { recursive: true });

  try {
    const content = await readFile(secretsPath, 'utf8');
    return { secretsDir, secretsPath, data: JSON.parse(content) };
  } catch {
    return { secretsDir, secretsPath, data: {} };
  }
}

async function writeSecretsStore(data) {
  const { secretsPath } = await readSecretsStore();
  await writeFile(secretsPath, JSON.stringify(data, null, 2));
}

function isSupportedAccountProvider(provider) {
  return provider === 'github' || provider === 'google' || provider === 'email';
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

async function getAppStoreDir() {
  const storeDir = path.join(app.getPath('userData'), '.vlaina', 'store');
  await mkdir(storeDir, { recursive: true });
  return storeDir;
}

async function getAccountStorePaths() {
  const storeDir = await getAppStoreDir();
  return {
    metaPath: path.join(storeDir, 'account-meta.json'),
    secretsPath: path.join(storeDir, 'account-secrets.json'),
  };
}

async function readStoredAccountCredentials() {
  const { metaPath, secretsPath } = await getAccountStorePaths();
  const meta = await readJsonFile(metaPath, null);
  const secrets = await readJsonFile(secretsPath, null);
  const provider = typeof meta?.provider === 'string' ? meta.provider.trim() : '';
  const username = typeof meta?.username === 'string' ? meta.username.trim() : '';
  const appSessionToken = typeof secrets?.appSessionToken === 'string' ? secrets.appSessionToken.trim() : '';

  if (!isSupportedAccountProvider(provider) || !username || !appSessionToken) {
    return null;
  }

  return {
    appSessionToken,
    provider,
    username,
    primaryEmail: typeof meta?.primaryEmail === 'string' ? meta.primaryEmail : null,
    avatarUrl: typeof meta?.avatarUrl === 'string' ? meta.avatarUrl : null,
  };
}

async function writeStoredAccountCredentials(credentials) {
  const { metaPath, secretsPath } = await getAccountStorePaths();
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        provider: credentials.provider,
        username: credentials.username,
        primaryEmail: credentials.primaryEmail ?? null,
        avatarUrl: credentials.avatarUrl ?? null,
      },
      null,
      2
    )
  );
  await writeFile(
    secretsPath,
    JSON.stringify(
      {
        appSessionToken: credentials.appSessionToken,
      },
      null,
      2
    )
  );
}

async function clearStoredAccountCredentials() {
  const { metaPath, secretsPath } = await getAccountStorePaths();
  await rm(metaPath, { force: true });
  await rm(secretsPath, { force: true });
}

async function rotateStoredSessionToken(headers) {
  const rotatedToken = headers.get(appSessionHeader)?.trim();
  if (!rotatedToken) {
    return;
  }

  const current = await readStoredAccountCredentials();
  if (!current) {
    return;
  }

  await writeStoredAccountCredentials({
    ...current,
    appSessionToken: rotatedToken,
  });
}

function disconnectedAccountStatus() {
  return {
    connected: false,
    provider: null,
    username: null,
    primaryEmail: null,
    avatarUrl: null,
    membershipTier: null,
    membershipName: null,
  };
}

function accountErrorResult(message) {
  return {
    success: false,
    provider: null,
    username: null,
    primaryEmail: null,
    avatarUrl: null,
    error: message,
  };
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new Error('Invalid JSON response');
      }
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : fallbackMessage
    );
  }

  return payload;
}

async function fetchDesktopJson(url, init = {}) {
  const response = await fetch(url, init);
  return { response, data: await readJsonResponse(response, `Request failed: HTTP ${response.status}`) };
}

async function fetchWithStoredSession(url, init = {}) {
  const credentials = await readStoredAccountCredentials();
  if (!credentials) {
    throw new Error('vlaina sign-in required');
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${credentials.appSessionToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    await clearStoredAccountCredentials();
    throw new Error('vlaina sign-in required');
  }

  await rotateStoredSessionToken(response.headers);
  return response;
}

function buildDesktopAuthStartUrl(provider) {
  return `${apiBaseUrl}/auth/${provider}/desktop/start`;
}

function buildDesktopAuthResultUrl(provider) {
  return `${apiBaseUrl}/auth/${provider}/desktop/result`;
}

function generateDesktopVerifier() {
  return randomBytes(48).toString('base64url');
}

async function bindLoopbackServer(timeoutSeconds) {
  let settled = false;
  let timer = null;
  let resolveCallback;
  let rejectCallback;

  const callbackPromise = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method !== 'GET') {
        response.writeHead(405, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>Authorization Failed</h1><p>Unsupported callback method.</p>');
        return;
      }

      if (requestUrl.pathname !== loopbackCallbackPath) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>Authorization Failed</h1><p>Unexpected OAuth callback path.</p>');
        return;
      }

      const state = requestUrl.searchParams.get('state')?.trim() ?? '';
      const resultToken = requestUrl.searchParams.get('result_token')?.trim() ?? '';
      const error = requestUrl.searchParams.get('error')?.trim() ?? null;

      if (!state || !resultToken) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<h1>Authorization Failed</h1><p>OAuth callback is missing state or result token.</p>');
        return;
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        error
          ? `<h1>Authorization Failed</h1><p>${error}</p><p>You can return to vlaina now.</p>`
          : '<h1>Authorization Successful</h1><p>You can close this window and return to vlaina.</p>'
      );

      if (!settled) {
        settled = true;
        clearTimeout(timer);
        server.close();
        resolveCallback({ state, resultToken, error });
      }
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<h1>Authorization Failed</h1><p>Invalid callback request.</p>');
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        server.close();
        rejectCallback(error);
      }
    }
  });

  const serverReady = await new Promise((resolve, reject) => {
    server.on('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to bind local OAuth callback server: ${error.message}`));
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        settled = true;
        server.close();
        reject(new Error('Failed to read local OAuth callback address'));
        return;
      }

      timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          server.close();
          rejectCallback(new Error('Authorization timed out'));
        }
      }, Math.max(30, timeoutSeconds) * 1000);

      resolve({
        callbackUrl: `http://127.0.0.1:${address.port}${loopbackCallbackPath}`,
      });
    });
  });

  return {
    ...serverReady,
    waitForCallback: () => callbackPromise,
  };
}

async function getDesktopAccountSessionStatus() {
  const credentials = await readStoredAccountCredentials();
  if (!credentials) {
    return disconnectedAccountStatus();
  }

  try {
    const response = await fetch(`${apiBaseUrl}/auth/session`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${credentials.appSessionToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      await clearStoredAccountCredentials();
      return disconnectedAccountStatus();
    }

    if (!response.ok) {
      return {
        connected: true,
        provider: credentials.provider,
        username: credentials.username,
        primaryEmail: credentials.primaryEmail,
        avatarUrl: credentials.avatarUrl,
        membershipTier: null,
        membershipName: null,
      };
    }

    await rotateStoredSessionToken(response.headers);
    const payload = await response.json();
    if (!payload?.success || payload.connected !== true) {
      await clearStoredAccountCredentials();
      return disconnectedAccountStatus();
    }

    const nextCredentials = {
      appSessionToken: (await readStoredAccountCredentials())?.appSessionToken ?? credentials.appSessionToken,
      provider: isSupportedAccountProvider(payload.provider) ? payload.provider : credentials.provider,
      username:
        typeof payload.username === 'string' && payload.username.trim()
          ? payload.username.trim()
          : credentials.username,
      primaryEmail:
        typeof payload.primaryEmail === 'string' ? payload.primaryEmail : credentials.primaryEmail,
      avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : credentials.avatarUrl,
    };
    await writeStoredAccountCredentials(nextCredentials);

    return {
      connected: true,
      provider: nextCredentials.provider,
      username: nextCredentials.username,
      primaryEmail: nextCredentials.primaryEmail,
      avatarUrl: nextCredentials.avatarUrl,
      membershipTier:
        payload.membershipTier === 'free' ||
        payload.membershipTier === 'plus' ||
        payload.membershipTier === 'pro' ||
        payload.membershipTier === 'max'
          ? payload.membershipTier
          : null,
      membershipName: typeof payload.membershipName === 'string' ? payload.membershipName : null,
    };
  } catch {
    return {
      connected: true,
      provider: credentials.provider,
      username: credentials.username,
      primaryEmail: credentials.primaryEmail,
      avatarUrl: credentials.avatarUrl,
      membershipTier: null,
      membershipName: null,
    };
  }
}

async function persistDesktopAuthResult(provider, result) {
  const appSessionToken =
    typeof result?.sessionToken === 'string' && result.sessionToken.trim() ? result.sessionToken.trim() : '';
  const username =
    typeof result?.username === 'string' && result.username.trim() ? result.username.trim() : '';

  if (!appSessionToken || !username) {
    throw new Error('Account sign-in result missing session token or username');
  }

  const credentials = {
    appSessionToken,
    provider,
    username,
    primaryEmail: typeof result?.primaryEmail === 'string' ? result.primaryEmail : null,
    avatarUrl: typeof result?.avatarUrl === 'string' ? result.avatarUrl : null,
  };
  await writeStoredAccountCredentials(credentials);

  return {
    success: true,
    provider,
    username,
    primaryEmail: credentials.primaryEmail,
    avatarUrl: credentials.avatarUrl,
    error: null,
  };
}

async function requestDesktopAuthResult(provider, state, verifier, resultToken) {
  const { data } = await fetchDesktopJson(buildDesktopAuthResultUrl(provider), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state,
      verifier,
      resultToken,
    }),
  });
  return data;
}

async function waitForDesktopAuthCompletion(provider, state, verifier, resultToken, expiresInSeconds) {
  const deadline = Date.now() + Math.max(300, Math.min(900, expiresInSeconds ?? 300)) * 1000;

  while (true) {
    const result = await requestDesktopAuthResult(provider, state, verifier, resultToken);
    if (result?.success === true || result?.pending !== true) {
      return result;
    }

    if (Date.now() >= deadline) {
      throw new Error('Authorization timed out');
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function performDesktopOauth(provider) {
  if (!isSupportedAccountProvider(provider) || provider === 'email') {
    return accountErrorResult('Unsupported desktop sign-in provider');
  }

  const verifier = generateDesktopVerifier();
  const loopback = await bindLoopbackServer(300);
  const { data: authStart } = await fetchDesktopJson(buildDesktopAuthStartUrl(provider), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      callbackUrl: loopback.callbackUrl,
      verifier,
    }),
  });

  const state = typeof authStart?.state === 'string' ? authStart.state.trim() : '';
  const authUrl = typeof authStart?.authUrl === 'string' ? authStart.authUrl.trim() : '';
  const expiresInSeconds =
    typeof authStart?.expiresInSeconds === 'number' ? authStart.expiresInSeconds : 300;

  if (!authStart?.success || !state || !authUrl) {
    return accountErrorResult('Sign-in start response is missing auth URL or state');
  }

  await shell.openExternal(authUrl);
  const callback = await loopback.waitForCallback();
  if (callback.state !== state) {
    return accountErrorResult('OAuth state mismatch');
  }
  const result = await waitForDesktopAuthCompletion(
    provider,
    callback.state,
    verifier,
    callback.resultToken,
    expiresInSeconds
  );

  if (!result?.success) {
    return accountErrorResult(callback.error || result?.error || 'Authorization failed');
  }

  return await persistDesktopAuthResult(provider, result);
}

async function requestManagedJson(pathname, init = {}) {
  const response = await fetchWithStoredSession(`${managedApiBaseUrl}${pathname}`, {
    ...init,
    cache: 'no-store',
  });
  return await readJsonResponse(response, `Managed API request failed: HTTP ${response.status}`);
}

async function createDesktopBillingCheckout(tier) {
  const response = await fetchWithStoredSession(`${apiBaseUrl}/billing/checkout`, {
    method: 'POST',
    cache: 'no-store',
    body: JSON.stringify({ tier }),
  });
  return await readJsonResponse(response, `Failed to create checkout session: HTTP ${response.status}`);
}

function isDevelopment() {
  return !app.isPackaged;
}

function normalizeExternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('A non-empty URL is required.');
  }

  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
    throw new Error(`Unsupported external URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}

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

function resolveTargetWindow(event) {
  if (event?.sender) {
    const fromSender = BrowserWindow.fromWebContents(event.sender);
    if (fromSender) {
      return fromSender;
    }
  }

  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
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
  window.on('closed', () => {
    closeApprovedWebContents.delete(window.webContents.id);
    windowLabels.delete(window.id);
  });

  window.on('close', (event) => {
    if (closeApprovedWebContents.has(window.webContents.id)) {
      closeApprovedWebContents.delete(window.webContents.id);
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
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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

ipcMain.handle('desktop:get-platform', () => 'electron');

ipcMain.handle('desktop:window:minimize', (event) => {
  resolveTargetWindow(event)?.minimize();
});

ipcMain.handle('desktop:window:maximize-toggle', (event) => {
  const window = resolveTargetWindow(event);
  if (!window) return false;

  if (window.isMaximized()) {
    window.unmaximize();
    return false;
  }

  window.maximize();
  return true;
});

ipcMain.handle('desktop:window:close', (event) => {
  resolveTargetWindow(event)?.close();
});

ipcMain.handle('desktop:window:confirm-close', (event) => {
  const window = resolveTargetWindow(event);
  if (!window) return;

  closeApprovedWebContents.add(window.webContents.id);
  window.close();
});

ipcMain.handle('desktop:window:is-maximized', (event) => {
  return resolveTargetWindow(event)?.isMaximized() ?? false;
});

ipcMain.handle('desktop:window:set-resizable', (event, resizable) => {
  resolveTargetWindow(event)?.setResizable(Boolean(resizable));
});

ipcMain.handle('desktop:window:set-maximizable', (event, maximizable) => {
  resolveTargetWindow(event)?.setMaximizable(Boolean(maximizable));
});

ipcMain.handle('desktop:window:set-min-size', (event, width, height) => {
  resolveTargetWindow(event)?.setMinimumSize(width, height);
});

ipcMain.handle('desktop:window:set-size', (event, width, height) => {
  resolveTargetWindow(event)?.setSize(width, height);
});

ipcMain.handle('desktop:window:center', (event) => {
  resolveTargetWindow(event)?.center();
});

ipcMain.handle('desktop:window:get-size', (event) => {
  const window = resolveTargetWindow(event);
  if (!window) {
    return { width: 0, height: 0 };
  }

  const [width, height] = window.getSize();
  return { width, height };
});

ipcMain.handle('desktop:window:get-label', (event) => {
  const window = resolveTargetWindow(event);
  return window ? getWindowLabel(window) : null;
});

ipcMain.handle('desktop:window:focus', (_event, label) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (getWindowLabel(window) === label) {
      window.focus();
      return true;
    }
  }

  return false;
});

ipcMain.handle('desktop:window:toggle-fullscreen', (event) => {
  const window = resolveTargetWindow(event);
  if (!window) return false;

  const next = !window.isFullScreen();
  window.setFullScreen(next);
  return next;
});

ipcMain.handle('desktop:window:create', (_event, windowOptions) => {
  createWindow({
    newWindow: true,
    vaultPath: windowOptions?.vaultPath ?? null,
    notePath: windowOptions?.notePath ?? null,
    viewMode: windowOptions?.viewMode ?? null,
  });
});

ipcMain.handle('desktop:shell:open-external', async (_event, url) => {
  await shell.openExternal(normalizeExternalUrl(url));
});

ipcMain.handle('desktop:shell:trash-item', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('A non-empty file path is required.');
  }

  await shell.trashItem(filePath);
});

ipcMain.handle('desktop:shell:reveal-item', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('A non-empty file path is required.');
  }

  shell.showItemInFolder(filePath);
});

ipcMain.handle('desktop:dialog:open', async (event, options) => {
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

  const result = await dialog.showOpenDialog(window ?? undefined, {
    title: options?.title,
    defaultPath: options?.defaultPath,
    filters: options?.filters,
    properties,
  });

  if (result.canceled) {
    return null;
  }

  if (options?.multiple) {
    return result.filePaths;
  }

  return result.filePaths[0] ?? null;
});

ipcMain.handle('desktop:dialog:save', async (event, options) => {
  const window = resolveTargetWindow(event);
  const result = await dialog.showSaveDialog(window ?? undefined, {
    title: options?.title,
    defaultPath: options?.defaultPath,
    filters: options?.filters,
  });
  return result.canceled ? null : result.filePath ?? null;
});

ipcMain.handle('desktop:dialog:message', async (event, message, options) => {
  const window = resolveTargetWindow(event);
  await dialog.showMessageBox(window ?? undefined, {
    type: options?.kind ?? 'info',
    title: options?.title,
    message,
  });
});

ipcMain.handle('desktop:dialog:confirm', async (event, message, options) => {
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

ipcMain.handle('desktop:fs:write-binary', async (_event, filePath, bytes) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  await writeFile(filePath, Buffer.from(bytes));
});

ipcMain.handle('desktop:fs:read-binary', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  return new Uint8Array(await readFile(filePath));
});

ipcMain.handle('desktop:fs:read-text', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  return readFile(filePath, 'utf8');
});

ipcMain.handle('desktop:fs:write-text', async (_event, filePath, content, options) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  if (options?.recursive) {
    await mkdir(path.dirname(filePath), { recursive: true });
  }

  if (options?.append) {
    const previous = await readFile(filePath, 'utf8').catch(() => '');
    await writeFile(filePath, previous + String(content ?? ''));
    return;
  }

  await writeFile(filePath, String(content ?? ''));
});

ipcMain.handle('desktop:fs:exists', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) {
    return false;
  }

  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('desktop:fs:mkdir', async (_event, filePath, recursive) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  await mkdir(filePath, { recursive: Boolean(recursive) });
});

ipcMain.handle('desktop:fs:delete-file', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  await rm(filePath, { force: true });
});

ipcMain.handle('desktop:fs:delete-dir', async (_event, filePath, recursive) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  await rm(filePath, { recursive: Boolean(recursive), force: true });
});

ipcMain.handle('desktop:fs:list-dir', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('A file path is required.');
  }

  let entries;
  try {
    entries = await readdir(filePath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return entries.map((entry) => ({
    name: entry.name,
    path: path.join(filePath, entry.name),
    isDirectory: entry.isDirectory(),
    isFile: entry.isFile(),
  }));
});

ipcMain.handle('desktop:fs:rename', async (_event, oldPath, newPath) => {
  await rename(oldPath, newPath);
});

ipcMain.handle('desktop:fs:copy-file', async (_event, sourcePath, targetPath) => {
  await copyFile(sourcePath, targetPath);
});

ipcMain.handle('desktop:fs:stat', async (_event, filePath) => {
  try {
    const info = await stat(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      isDirectory: info.isDirectory(),
      isFile: info.isFile(),
      size: info.size,
      modifiedAt: info.mtimeMs,
    };
  } catch {
    return null;
  }
});

ipcMain.handle('desktop:path:join', (_event, ...segments) => {
  return path.join(...segments);
});

ipcMain.handle('desktop:path:app-data', () => {
  return app.getPath('userData');
});

ipcMain.handle('desktop:path:to-file-url', (_event, filePath) => {
  return pathToFileURL(filePath).toString();
});

ipcMain.handle('desktop:secrets:get-ai-provider-secrets', async (_event, providerIds) => {
  const { data } = await readSecretsStore();
  const result = {};

  for (const providerId of providerIds ?? []) {
    if (typeof providerId === 'string' && typeof data[providerId] === 'string') {
      result[providerId] = data[providerId];
    }
  }

  return result;
});

ipcMain.handle('desktop:secrets:set-ai-provider-secret', async (_event, providerId, apiKey) => {
  if (typeof providerId !== 'string' || !providerId.trim()) {
    throw new Error('A provider id is required.');
  }

  const store = await readSecretsStore();
  store.data[providerId] = String(apiKey ?? '');
  await writeSecretsStore(store.data);
});

ipcMain.handle('desktop:secrets:delete-ai-provider-secret', async (_event, providerId) => {
  if (typeof providerId !== 'string' || !providerId.trim()) {
    throw new Error('A provider id is required.');
  }

  const store = await readSecretsStore();
  delete store.data[providerId];
  await writeSecretsStore(store.data);
});

ipcMain.handle('desktop:account:get-session-status', async () => {
  return await getDesktopAccountSessionStatus();
});

ipcMain.handle('desktop:account:start-auth', async (_event, provider) => {
  return await performDesktopOauth(String(provider ?? ''));
});

ipcMain.handle('desktop:account:request-email-code', async (_event, email) => {
  const response = await fetch(`${apiBaseUrl}/auth/email/request-code`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  await readJsonResponse(response, `Failed to send verification code: HTTP ${response.status}`);
  return true;
});

ipcMain.handle('desktop:account:verify-email-code', async (_event, email, code) => {
  const { data } = await fetchDesktopJson(`${apiBaseUrl}/auth/email/verify-code`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      code,
      target: 'desktop',
    }),
  });

  if (!data?.success) {
    return accountErrorResult(data?.error || 'Email sign-in failed');
  }

  return await persistDesktopAuthResult('email', data);
});

ipcMain.handle('desktop:account:disconnect', async () => {
  const credentials = await readStoredAccountCredentials();
  if (credentials?.appSessionToken) {
    try {
      await fetch(`${apiBaseUrl}/auth/session/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.appSessionToken}`,
        },
      });
    } catch {
    }
  }

  await clearStoredAccountCredentials();
});

ipcMain.handle('desktop:billing:create-checkout', async (_event, tier) => {
  return await createDesktopBillingCheckout(String(tier ?? ''));
});

ipcMain.handle('desktop:managed:get-models', async () => {
  return await requestManagedJson('/models', { method: 'GET' });
});

ipcMain.handle('desktop:managed:get-budget', async () => {
  return await requestManagedJson('/budget', { method: 'GET' });
});

ipcMain.handle('desktop:managed:chat-completion', async (_event, body) => {
  return await requestManagedJson('/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
});

ipcMain.handle('desktop:managed:chat-completion-stream:start', async (event, requestId, body) => {
  const id = String(requestId ?? '').trim();
  if (!id) {
    throw new Error('A managed stream request id is required.');
  }

  const previous = activeManagedStreams.get(id);
  previous?.abort();

  const controller = new AbortController();
  activeManagedStreams.set(id, controller);
  const sender = event.sender;

  void (async () => {
    try {
      const response = await fetchWithStoredSession(`${managedApiBaseUrl}/chat/completions`, {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body ?? {}),
      });

      if (!response.ok) {
        throw new Error(await response.text().catch(() => `Managed stream failed: HTTP ${response.status}`));
      }

      if (!response.body) {
        throw new Error('Managed API response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let hasStartedReasoning = false;
      let hasFinishedReasoning = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) {
            continue;
          }

          try {
            const payload = JSON.parse(trimmed.slice(6));
            const delta = Array.isArray(payload.choices) ? payload.choices[0]?.delta : undefined;
            const reasoning =
              typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : null;
            const content = typeof delta?.content === 'string' ? delta.content : null;

            if (reasoning) {
              if (!hasStartedReasoning) {
                fullContent += '<think>';
                hasStartedReasoning = true;
              }
              fullContent += reasoning;
            }

            if (content) {
              if (hasStartedReasoning && !hasFinishedReasoning) {
                fullContent += '</think>';
                hasFinishedReasoning = true;
              }
              fullContent += content;
            }

            if (reasoning || content) {
              sender.send(`desktop:managed:stream:${id}:chunk`, fullContent);
            }
          } catch {
          }
        }
      }

      if (hasStartedReasoning && !hasFinishedReasoning) {
        fullContent += '</think>';
      }

      sender.send(`desktop:managed:stream:${id}:done`, { content: fullContent });
    } catch (error) {
      if (controller.signal.aborted) {
        sender.send(`desktop:managed:stream:${id}:error`, { message: 'Aborted' });
      } else {
        sender.send(`desktop:managed:stream:${id}:error`, {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      activeManagedStreams.delete(id);
    }
  })();
});

ipcMain.handle('desktop:managed:chat-completion-stream:cancel', async (_event, requestId) => {
  const id = String(requestId ?? '').trim();
  const controller = activeManagedStreams.get(id);
  if (controller) {
    controller.abort();
    activeManagedStreams.delete(id);
  }
});

ipcMain.handle('desktop:fs:watch', (event, watchPath) => {
  if (typeof watchPath !== 'string' || !watchPath) {
    throw new Error('A watch path is required.');
  }

  const watchId = `watch-${++watcherCounter}`;
  const sender = event.sender;
  const listener = watch(
    watchPath,
    { recursive: true },
    (eventType, filename) => {
      const resolvedPath = filename ? path.join(watchPath, filename.toString()) : watchPath;
      const payload = eventType === 'rename'
        ? { type: { remove: { kind: 'any' } }, paths: [resolvedPath] }
        : { type: { modify: { kind: 'data', mode: 'any' } }, paths: [resolvedPath] };
      sender.send(`desktop:fs:watch:${watchId}`, payload);
    },
  );

  activeWatchers.set(watchId, listener);
  return watchId;
});

ipcMain.handle('desktop:fs:unwatch', (_event, watchId) => {
  const listener = activeWatchers.get(watchId);
  if (listener) {
    listener.close();
    activeWatchers.delete(watchId);
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.vlaina.desktop');
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
