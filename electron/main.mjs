import electron from 'electron';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesktopAccountService } from './accountAuthFlow.mjs';
import { readSecretsStore, updateSecretsStore } from './aiProviderSecretStore.mjs';
import { registerDesktopIpc } from './desktopIpc.mjs';
import { registerManagedIpc } from './managedIpc.mjs';
import { isTrustedRendererUrl as isTrustedRendererUrlForConfig } from './rendererTrust.mjs';
import { createWindowManager } from './windowManager.mjs';
import { configureDevelopmentUserDataPath } from './userDataPath.mjs';
import { authorizeFsPath } from './fsAccess.mjs';
import { installApplicationMenu } from './appMenu.mjs';
import { createWebSearchServices, registerWebSearchIpc } from './webSearch/ipc.mjs';

const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, session, shell } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

configureDevelopmentUserDataPath({ app, repoRoot });

const rendererDevUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:3000';
const apiBaseUrl = (process.env.APP_API_BASE_URL ?? 'https://api.vlaina.com').trim().replace(/\/+$/, '');
const managedApiBaseUrl = `${apiBaseUrl}/v1`;
const updateManifestUrl = (
  process.env.APP_UPDATE_MANIFEST_URL
  ?? 'https://api.github.com/repos/vladelaina/vlaina/releases/latest'
).trim();
const defaultDownloadUrl = (
  process.env.APP_DOWNLOAD_URL
  ?? 'https://github.com/vladelaina/vlaina/releases/latest'
).trim();
const appIconPath = path.join(__dirname, '..', app.isPackaged ? 'dist' : 'public', 'logo.png');
const trayIconSize = process.platform === 'darwin' ? 18 : 16;
const rendererFile = path.join(__dirname, '..', 'dist', 'index.html');
const desktopAccountService = createDesktopAccountService({ apiBaseUrl });
const { fetchWithStoredSession, readJsonResponse } = desktopAccountService;
let tray = null;
let trayQuitRequested = false;
let trayLanguage = 'en';
let pendingOpenMarkdownPath = null;
const readOnlyNetworkRetryDelaysMs = [300];
const readOnlyFastFailureRetryWindowMs = 2000;
const managedReadOnlyRequestTimeoutMs = 15_000;

const supportedTrayLanguages = new Set([
  'en',
  'zh-CN',
  'zh-Hant',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'pt-BR',
  'it',
  'ru',
  'tr',
  'vi',
  'id',
  'th',
]);

const trayMessages = {
  en: { open: 'Open vlaina', quit: 'Quit' },
  'zh-CN': { open: '打开 vlaina', quit: '退出' },
  'zh-Hant': { open: '開啟 vlaina', quit: '結束' },
  ja: { open: 'vlaina を開く', quit: '終了' },
  ko: { open: 'vlaina 열기', quit: '종료' },
  fr: { open: 'Ouvrir vlaina', quit: 'Quitter' },
  de: { open: 'vlaina öffnen', quit: 'Beenden' },
  es: { open: 'Abrir vlaina', quit: 'Salir' },
  'pt-BR': { open: 'Abrir vlaina', quit: 'Sair' },
  it: { open: 'Apri vlaina', quit: 'Esci' },
  ru: { open: 'Открыть vlaina', quit: 'Выйти' },
  tr: { open: 'vlaina aç', quit: 'Çık' },
  vi: { open: 'Mở vlaina', quit: 'Thoát' },
  id: { open: 'Buka vlaina', quit: 'Keluar' },
  th: { open: 'เปิด vlaina', quit: 'ออก' },
};

function installDevelopmentParentProcessGuard() {
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

process.on('uncaughtException', (error) => {
  console.error('[vlaina] Uncaught exception in Electron main process:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[vlaina] Unhandled rejection in Electron main process:', reason);
});

function normalizeProxyConfig(rawProxy, source) {
  const proxy = String(rawProxy ?? '').trim();
  if (!proxy) return null;

  try {
    const parsed = new URL(proxy);
    if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsed.protocol)) {
      return null;
    }
    const host = parsed.hostname.includes(':') ? `[${parsed.hostname}]` : parsed.hostname;
    const hostPort = parsed.port ? `${host}:${parsed.port}` : host;
    const proxyRules = parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? `http=${hostPort};https=${hostPort}`
      : `${parsed.protocol}//${hostPort}`;
    return {
      proxyServer: redactUrlCredentials(parsed),
      proxyRules,
      source,
    };
  } catch {
    return null;
  }
}

function redactUrlCredentials(rawUrl) {
  try {
    const parsed = rawUrl instanceof URL ? new URL(rawUrl.toString()) : new URL(String(rawUrl));
    if (parsed.username || parsed.password) {
      parsed.username = parsed.username ? 'redacted' : '';
      parsed.password = parsed.password ? 'redacted' : '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function summarizeUrlForLog(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl));
    parsed.search = '';
    parsed.hash = '';
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function getConfiguredProxyConfig() {
  const rawProxy = process.env.LOCAL_PROXY_URL
    ?? process.env.HTTPS_PROXY
    ?? process.env.HTTP_PROXY
    ?? process.env.ALL_PROXY
    ?? process.env.https_proxy
    ?? process.env.http_proxy
    ?? process.env.all_proxy
    ?? '';
  const source = process.env.LOCAL_PROXY_URL ? 'LOCAL_PROXY_URL' : 'standard-proxy-env';
  return normalizeProxyConfig(rawProxy, source);
}

function canConnectToLocalProxy(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (available) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(250);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function resolveProxyConfig() {
  const configured = getConfiguredProxyConfig();
  if (configured) return configured;
  if (await canConnectToLocalProxy(10808)) {
    return normalizeProxyConfig('http://127.0.0.1:10808', 'auto-detected-local-10808');
  }
  return null;
}

const configuredProxyConfig = getConfiguredProxyConfig();
if (configuredProxyConfig) {
  app.commandLine.appendSwitch('proxy-server', configuredProxyConfig.proxyRules);
  app.commandLine.appendSwitch('proxy-bypass-list', '127.0.0.1;localhost;<local>');
}

async function configureProxySafely() {
  try {
    const proxyConfig = await resolveProxyConfig();
    if (!proxyConfig) return;

    await session.defaultSession.setProxy({
      proxyRules: proxyConfig.proxyRules,
      proxyBypassRules: '127.0.0.1;localhost;<local>',
    });
  } catch (error) {
  }
}

function configureDefaultSessionSafely() {
  try {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(() => false);
  } catch (error) {
  }
}

function fetchWithElectronSession(url, init) {
  return electron.net.fetch(url, init);
}

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

async function raceWithAbort(promise, signal) {
  throwIfAborted(signal);
  if (!signal) {
    return await promise;
  }
  promise.catch(() => undefined);

  return await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            reject(error);
          } catch (abortError) {
            reject(abortError);
          }
        });
      },
    );
  });
}

function createTimedRequestInit(init = {}, timeoutMs = null) {
  if (!timeoutMs || init.signal?.aborted) {
    return {
      requestInit: init,
      cleanup: () => {},
    };
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);
  let cleanupExternalAbort = () => {};
  let signal = timeoutController.signal;

  if (init.signal) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      signal = AbortSignal.any([init.signal, timeoutController.signal]);
    } else {
      const abortFromExternal = () => {
        timeoutController.abort();
      };
      init.signal.addEventListener('abort', abortFromExternal, { once: true });
      cleanupExternalAbort = () => {
        init.signal.removeEventListener('abort', abortFromExternal);
      };
    }
  }

  return {
    requestInit: {
      ...init,
      signal,
    },
    cleanup: () => {
      clearTimeout(timeout);
      cleanupExternalAbort();
    },
  };
}

function delayReadOnlyNetworkRetry(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let timeout = null;
    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(createAbortError());
    };
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function retryReadOnlyNetworkFailure(operation, init = {}) {
  const method = String(init.method ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    return await operation();
  }

  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await operation();
    } catch (error) {
      const retryDelayMs = readOnlyNetworkRetryDelaysMs[attempt];
      const failedQuickly = Date.now() - startedAt <= readOnlyFastFailureRetryWindowMs;
      if (init.signal?.aborted || retryDelayMs == null || !failedQuickly) {
        throw error;
      }
      await delayReadOnlyNetworkRetry(retryDelayMs, init.signal);
    }
  }
}

async function requestManagedJson(pathname, init = {}) {
  const method = String(init.method ?? 'GET').toUpperCase();
  const { requestInit, cleanup } = createTimedRequestInit({
    ...init,
    cache: 'no-store',
  }, method === 'GET' ? managedReadOnlyRequestTimeoutMs : null);
  try {
    const response = await retryReadOnlyNetworkFailure(
      () => fetchWithStoredSession(`${managedApiBaseUrl}${pathname}`, requestInit),
      requestInit,
    );
    return await readJsonResponse(response, `Managed API request failed: HTTP ${response.status}`, requestInit.signal);
  } finally {
    cleanup();
  }
}

async function requestManagedPublicJson(pathname, init = {}) {
  const method = String(init.method ?? 'GET').toUpperCase();
  const { requestInit, cleanup } = createTimedRequestInit({
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  }, method === 'GET' ? managedReadOnlyRequestTimeoutMs : null);
  try {
    const response = await retryReadOnlyNetworkFailure(
      () => {
        throwIfAborted(requestInit.signal);
        return raceWithAbort(fetch(`${managedApiBaseUrl}${pathname}`, requestInit), requestInit.signal);
      },
      requestInit,
    );
    return await readJsonResponse(response, `Managed API request failed: HTTP ${response.status}`, requestInit.signal);
  } finally {
    cleanup();
  }
}

async function createElectronBillingCheckout(tier) {
  const response = await fetchWithStoredSession(`${apiBaseUrl}/billing/checkout`, {
    method: 'POST',
    cache: 'no-store',
    body: JSON.stringify({ tier }),
  });
  return await readJsonResponse(response, `Failed to create checkout session: HTTP ${response.status}`);
}

async function submitElectronFeedback(message) {
  const response = await fetchWithStoredSession(`${apiBaseUrl}/feedback`, {
    method: 'POST',
    cache: 'no-store',
    body: JSON.stringify({ message: String(message ?? '') }),
  });
  return await readJsonResponse(response, `Failed to submit feedback: HTTP ${response.status}`);
}

function isDevelopment() {
  return !app.isPackaged;
}

function isSupportedMarkdownPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return false;
  }

  return ['.md', '.markdown', '.mdown', '.mkd'].includes(path.extname(filePath).toLowerCase());
}

function normalizeMarkdownOpenPath(value) {
  const rawPath = typeof value === 'string' ? value.trim() : '';
  if (!rawPath) {
    return null;
  }

  let filePath = rawPath;
  if (rawPath.startsWith('file://')) {
    try {
      filePath = fileURLToPath(rawPath);
    } catch {
      return null;
    }
  }

  if (!isSupportedMarkdownPath(filePath)) {
    return null;
  }

  const absolutePath = path.resolve(filePath);
  try {
    if (!fs.statSync(absolutePath).isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return absolutePath;
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

async function authorizeMarkdownOpenPath(filePath) {
  await authorizeFsPath(filePath, 'file');

  const parentPath = path.dirname(filePath);
  await authorizeFsPath(parentPath, 'root');
  await authorizeFsPath(path.dirname(parentPath), 'watch-root');
}

function showMainWindow() {
  const existingWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
  const window = existingWindow ?? createMainWindow();

  focusWindow(window, { forceShow: Boolean(existingWindow) });
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

function requestTrayQuit() {
  trayQuitRequested = true;

  const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  if (windows.length === 0) {
    app.quit();
    return;
  }

  for (const window of windows) {
    window.close();
  }
}

function getTrayMessages() {
  return trayMessages[trayLanguage] ?? trayMessages.en;
}

function setTrayContextMenu() {
  if (!tray) return;
  const messages = getTrayMessages();
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: messages.open,
      click: showMainWindow,
    },
    { type: 'separator' },
    {
      label: messages.quit,
      click: requestTrayQuit,
    },
  ]));
}

function setTrayLanguage(language) {
  if (!supportedTrayLanguages.has(language)) return false;
  trayLanguage = language;
  setTrayContextMenu();
  return true;
}

function createTrayIcon() {
  const icon = nativeImage.createFromPath(appIconPath);
  if (icon.isEmpty()) {
    return appIconPath;
  }

  const trayIcon = icon.resize({
    width: trayIconSize,
    height: trayIconSize,
    quality: 'best',
  });
  return trayIcon;
}

function createTray() {
  if (tray) return;

  try {
    tray = new Tray(createTrayIcon());
    tray.setToolTip('vlaina');
    setTrayContextMenu();
    tray.on('click', showMainWindow);
  } catch (error) {
    tray = null;
  }
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

function normalizeHttpUrl(rawUrl, label) {
  const normalized = normalizeExternalUrl(rawUrl);
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must be an HTTP or HTTPS URL.`);
  }
  return parsed.toString();
}

function parseVersionParts(version) {
  return String(version ?? '')
    .trim()
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((part) => {
      const numeric = Number.parseInt(part, 10);
      return Number.isFinite(numeric) ? numeric : 0;
    });
}

function compareVersions(left, right) {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function normalizeReleaseVersion(rawVersion) {
  return String(rawVersion ?? '')
    .trim()
    .replace(/^v/i, '');
}

function splitReleaseAssetNameParts(name) {
  return String(name ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function getCurrentAssetArchAliases() {
  if (process.arch === 'x64') return ['x64', 'amd64'];
  if (process.arch === 'arm64') return ['arm64', 'aarch64'];
  if (process.arch === 'ia32') return ['ia32', 'x86'];
  return [process.arch];
}

function releaseAssetPartsIncludeAny(parts, aliases) {
  return aliases.some((alias) => parts.includes(alias));
}

function normalizeReleaseAssets(rawAssets) {
  if (!Array.isArray(rawAssets)) {
    return [];
  }

  return rawAssets
    .map((asset) => {
      if (!asset || typeof asset !== 'object') {
        return null;
      }

      const name = typeof asset.name === 'string' ? asset.name : '';
      const downloadUrl = typeof asset.browser_download_url === 'string'
        ? asset.browser_download_url
        : typeof asset.downloadUrl === 'string'
          ? asset.downloadUrl
          : '';

      if (!name || !downloadUrl) {
        return null;
      }

      try {
        return {
          name,
          downloadUrl: normalizeHttpUrl(downloadUrl, 'Release asset URL'),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getCurrentPlatformAssetPriority() {
  if (process.platform === 'win32') {
    return [
      (name) => name.endsWith('.exe') && name.includes('setup') && !name.includes('portable'),
      (name) => name.endsWith('.exe') && !name.includes('portable'),
      (name) => name.endsWith('.exe'),
    ];
  }

  if (process.platform === 'darwin') {
    return [
      (name) => name.endsWith('.dmg'),
      (name) => name.endsWith('.zip'),
    ];
  }

  if (process.platform === 'linux') {
    return [
      (name) => name.endsWith('.appimage'),
      (name) => name.endsWith('.deb'),
      (name) => name.endsWith('.tar.gz'),
    ];
  }

  return [];
}

function selectCurrentPlatformAsset(assets) {
  const platformPriority = getCurrentPlatformAssetPriority();
  const normalizedAssets = assets.map((asset) => ({
    ...asset,
    normalizedName: asset.name.toLowerCase(),
    nameParts: splitReleaseAssetNameParts(asset.name),
  }));
  const platformAssets = normalizedAssets.filter((asset) =>
    platformPriority.some((matchesAsset) => matchesAsset(asset.normalizedName))
  );
  const knownArchAliases = ['x64', 'amd64', 'arm64', 'aarch64', 'ia32', 'x86'];
  const currentArchAliases = getCurrentAssetArchAliases();
  const currentArchAssets = platformAssets.filter((asset) =>
    releaseAssetPartsIncludeAny(asset.nameParts, currentArchAliases)
  );
  const platformAssetsWithKnownArch = platformAssets.filter((asset) =>
    releaseAssetPartsIncludeAny(asset.nameParts, knownArchAliases)
  );
  const candidateAssets = currentArchAssets.length > 0
    ? currentArchAssets
    : platformAssetsWithKnownArch.length > 0
      ? []
      : platformAssets;

  for (const matchesAsset of platformPriority) {
    const match = candidateAssets.find((asset) => matchesAsset(asset.normalizedName));
    if (match) {
      return {
        name: match.name,
        downloadUrl: match.downloadUrl,
      };
    }
  }

  return null;
}

function normalizeUpdateManifest(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Update manifest must be a JSON object.');
  }

  const latestVersion = requireNonEmptyString(
    payload.version ?? payload.tag_name,
    'latest version'
  ).trim();
  const normalizedLatestVersion = normalizeReleaseVersion(latestVersion);
  const releaseUrl = normalizeHttpUrl(
    payload.downloadUrl ?? payload.html_url ?? defaultDownloadUrl,
    'Download URL'
  );
  const assets = normalizeReleaseAssets(payload.assets);
  const platformAsset = selectCurrentPlatformAsset(assets);
  const releaseNotes = typeof payload.releaseNotes === 'string'
    ? payload.releaseNotes
    : typeof payload.body === 'string'
      ? payload.body
      : '';
  const publishedAt = typeof payload.publishedAt === 'string'
    ? payload.publishedAt
    : typeof payload.published_at === 'string'
      ? payload.published_at
      : '';

  return {
    latestVersion: normalizedLatestVersion,
    downloadUrl: platformAsset?.downloadUrl ?? releaseUrl,
    releaseUrl,
    platformAssetName: platformAsset?.name ?? '',
    hasPlatformAsset: Boolean(platformAsset),
    releaseNotes,
    publishedAt,
  };
}

async function fetchUpdateManifest() {
  const manifestUrl = normalizeHttpUrl(updateManifestUrl, 'Update manifest URL');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': `vlaina/${app.getVersion()} desktop-updater`,
      },
    });

    if (!response.ok) {
      throw new Error(`Update manifest request failed: HTTP ${response.status}`);
    }

    return normalizeUpdateManifest(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function isTrustedRendererUrl(rawUrl) {
  return isTrustedRendererUrlForConfig(rawUrl, { rendererDevUrl, rendererFile });
}

function resolveTrustedSenderUrl(event) {
  const candidates = [
    event?.senderFrame?.url,
    event?.senderFrame?.top?.url,
    event?.sender?.getURL?.(),
    BrowserWindow.fromWebContents(event?.sender ?? null)?.webContents?.getURL?.(),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return '';
}

function assertTrustedIpcSender(event) {
  const senderUrl = resolveTrustedSenderUrl(event);
  if (!isTrustedRendererUrl(senderUrl)) {
    throw new Error(`Blocked IPC from untrusted renderer: ${senderUrl || 'unknown sender'}`);
  }
}

function handleIpc(channel, listener) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedIpcSender(event);
    return await listener(event, ...args);
  });
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`A non-empty ${label} is required.`);
  }

  return value;
}

function requireStringArray(values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`A ${label} array is required.`);
  }

  return values.map((value, index) => requireNonEmptyString(value, `${label} value at index ${index}`));
}

function isSafeProviderId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
  );
}

function requireSafeProviderId(value) {
  const providerId = requireNonEmptyString(value, 'provider id').trim();
  if (!isSafeProviderId(providerId)) {
    throw new Error('Provider id contains unsupported characters.');
  }
  return providerId;
}

function tryNormalizeExternalUrl(rawUrl) {
  try {
    return normalizeExternalUrl(rawUrl);
  } catch {
    return null;
  }
}

function extractBilibiliBvid(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return null;
  }

  return rawUrl.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/)?.[1]
    ?? rawUrl.match(/[?&]bvid=(BV[a-zA-Z0-9]+)/)?.[1]
    ?? null;
}

function buildBilibiliEmbedUrl({ bvid, aid, cid, page }) {
  const params = new URLSearchParams({
    isOutside: 'true',
    bvid,
    p: String(page ?? 1),
    danmaku: '0',
    autoplay: '0',
  });

  if (typeof aid === 'number' && Number.isFinite(aid)) {
    params.set('aid', String(aid));
  }

  if (typeof cid === 'number' && Number.isFinite(cid)) {
    params.set('cid', String(cid));
  }

  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

function parsePositiveNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeCaptureRect(rect) {
  const x = Math.max(0, Math.floor(Number(rect?.x)));
  const y = Math.max(0, Math.floor(Number(rect?.y)));
  const width = Math.max(1, Math.ceil(Number(rect?.width)));
  const height = Math.max(1, Math.ceil(Number(rect?.height)));

  if (![x, y, width, height].every(Number.isFinite)) {
    throw new Error('A valid capture rectangle is required.');
  }

  return { x, y, width, height };
}

async function resolveVideoUrl(rawUrl) {
  const startedAt = Date.now();
  const inputUrl = requireNonEmptyString(rawUrl, 'video URL').trim();
  const bvid = extractBilibiliBvid(inputUrl);
  if (!bvid) {
    return {
      resolvedUrl: inputUrl,
      source: 'unchanged',
      durationMs: Date.now() - startedAt,
      stage: 'no-bvid',
    };
  }

  const timeoutMs = 6000;
  let timeoutFired = false;
  let stage = 'start';
  let timeout = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => {
      timeoutFired = true;
      stage = 'timeout';
      controller.abort();
    }, timeoutMs);
    stage = 'fetching';
    const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        referer: 'https://www.bilibili.com/',
        'user-agent': 'Mozilla/5.0 vlaina desktop',
      },
    });
    stage = 'headers';
    stage = 'json';
    const payload = await response.json();
    stage = 'parsed-json';
    const aid = parsePositiveNumber(payload?.data?.aid);
    const cid = parsePositiveNumber(payload?.data?.cid ?? payload?.data?.pages?.[0]?.cid);
    const page = parsePositiveNumber(payload?.data?.pages?.[0]?.page);

    if (!response.ok || payload?.code !== 0 || !cid) {
      return {
        resolvedUrl: inputUrl,
        source: 'fallback',
        error: `Bilibili resolve failed: HTTP ${response.status}, code ${payload?.code ?? 'unknown'}`,
        bvid,
        stage,
        timeoutFired,
        durationMs: Date.now() - startedAt,
      };
    }

    const resolvedUrl = buildBilibiliEmbedUrl({
      bvid,
      aid: aid ?? undefined,
      cid,
      page: page ?? undefined,
    });
    return {
      resolvedUrl,
      source: 'bilibili',
      bvid,
      aid,
      cid,
      page,
      stage,
      timeoutFired,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      resolvedUrl: inputUrl,
      source: 'fallback',
      error: error instanceof Error ? error.message : String(error),
      bvid,
      stage,
      timeoutFired,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function openExternalIfAllowed(rawUrl) {
  const normalized = tryNormalizeExternalUrl(rawUrl);
  if (!normalized) {
    return false;
  }

  void shell.openExternal(normalized);
  return true;
}

const windowManager = createWindowManager({
  rendererDevUrl,
  appIconPath,
  isDevelopment,
  openExternalIfAllowed,
  isTrustedRendererUrl,
});
const { createMainWindow, isReadyToReveal, resolveTargetWindow } = windowManager;
windowManager.registerWindowIpc(handleIpc);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.exit(0);
} else {
  installDevelopmentParentProcessGuard();
  pendingOpenMarkdownPath = findMarkdownPathInArgv(process.argv);

  app.on('second-instance', (_event, argv) => {
    const markdownPath = findMarkdownPathInArgv(argv);
    if (markdownPath) {
      void openMarkdownPath(markdownPath);
      return;
    }

    showMainWindow();
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    void openMarkdownPath(filePath);
  });
}

registerDesktopIpc({
  handleIpc,
  normalizeExternalUrl,
  resolveTargetWindow,
  requireNonEmptyString,
  requireStringArray,
});

registerWebSearchIpc({
  handleIpc,
  services: createWebSearchServices({ fetchImpl: fetchWithElectronSession }),
});

handleIpc('desktop:secrets:get-ai-provider-secrets', async (_event, providerIds) => {
  const { data } = await readSecretsStore();
  const result = {};

  for (const providerId of requireStringArray(providerIds, 'provider id')) {
    const normalizedProviderId = requireSafeProviderId(providerId);
    if (typeof data[normalizedProviderId] === 'string') {
      result[normalizedProviderId] = data[normalizedProviderId];
    }
  }

  return result;
});

handleIpc('desktop:secrets:set-ai-provider-secret', async (_event, providerId, apiKey) => {
  const normalizedProviderId = requireSafeProviderId(providerId);
  await updateSecretsStore((data) => {
    data[normalizedProviderId] = String(apiKey ?? '');
  });
});

handleIpc('desktop:secrets:delete-ai-provider-secret', async (_event, providerId) => {
  const normalizedProviderId = requireSafeProviderId(providerId);
  await updateSecretsStore((data) => {
    delete data[normalizedProviderId];
  });
});

handleIpc('desktop:media:resolve-video-url', async (_event, url) => {
  return await resolveVideoUrl(url);
});

handleIpc('desktop:media:diagnose-url', async (_event, url) => {
  const normalizedUrl = normalizeExternalUrl(url);
  const proxy = await session.defaultSession.resolveProxy(normalizedUrl);
  const result = {
    url: normalizedUrl,
    proxy,
    proxyConfig: configuredProxyConfig,
  };
  return result;
});

handleIpc('desktop:media:capture-page', async (event, rect) => {
  const image = await event.sender.capturePage(normalizeCaptureRect(rect));
  return image.toDataURL();
});

handleIpc('desktop:get-version', async () => {
  return app.getVersion();
});

handleIpc('desktop:app:set-language', async (_event, language) => {
  return setTrayLanguage(language);
});

handleIpc('desktop:update:check', async () => {
  const currentVersion = app.getVersion();
  const manifest = await fetchUpdateManifest();

  return {
    currentVersion,
    ...manifest,
    updateAvailable: compareVersions(manifest.latestVersion, currentVersion) > 0,
  };
});

desktopAccountService.registerAccountIpc({ handleIpc });

registerManagedIpc({
  handleIpc,
  requestManagedJson,
  requestManagedPublicJson,
  fetchWithStoredSession,
  managedApiBaseUrl,
  createElectronBillingCheckout,
  submitElectronFeedback,
  requireNonEmptyString,
});

app.whenReady().then(async () => {
  try {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.vlaina.desktop');
    }
  } catch (error) {
  }
  await configureProxySafely();
  configureDefaultSessionSafely();
  installApplicationMenu({ Menu, app, onOpenMarkdownFile: requestOpenMarkdownFile });

  createTray();
  const mainWindow = createMainWindow();
  if (pendingOpenMarkdownPath) {
    await sendOpenMarkdownPath(mainWindow, pendingOpenMarkdownPath);
    pendingOpenMarkdownPath = null;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}).catch((error) => {
});

app.on('window-all-closed', () => {
  if (trayQuitRequested || process.platform !== 'darwin') {
    app.quit();
  }
});
