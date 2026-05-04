import electron from 'electron';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDesktopAccountService } from './accountAuthFlow.mjs';
import { readSecretsStore, writeSecretsStore } from './aiProviderSecretStore.mjs';
import { registerDesktopIpc } from './desktopIpc.mjs';
import { registerManagedIpc } from './managedIpc.mjs';
import { isTrustedRendererUrl as isTrustedRendererUrlForConfig } from './rendererTrust.mjs';
import { createWindowManager } from './windowManager.mjs';

const { app, BrowserWindow, ipcMain, session, shell } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererDevUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:3000';
const apiBaseUrl = (process.env.APP_API_BASE_URL ?? 'https://api.vlaina.com').trim().replace(/\/+$/, '');
const managedApiBaseUrl = `${apiBaseUrl}/v1`;
const appIconPath = path.join(__dirname, '..', 'public', 'logo.png');
const rendererFile = path.join(__dirname, '..', 'dist', 'index.html');
const desktopAccountService = createDesktopAccountService({ apiBaseUrl });
const { fetchWithStoredSession, readJsonResponse } = desktopAccountService;

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
      proxyServer: parsed.toString(),
      proxyRules,
      source,
    };
  } catch {
    return null;
  }
}

function isVideoNetworkDebugUrl(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    return hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtube-nocookie.com'
      || hostname.endsWith('.youtube-nocookie.com')
      || hostname === 'ytimg.com'
      || hostname.endsWith('.ytimg.com')
      || hostname === 'googlevideo.com'
      || hostname.endsWith('.googlevideo.com')
      || hostname === 'gstatic.com'
      || hostname.endsWith('.gstatic.com')
      || hostname === 'google.com'
      || hostname.endsWith('.google.com');
  } catch {
    return false;
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

async function requestManagedJson(pathname, init = {}) {
  const response = await fetchWithStoredSession(`${managedApiBaseUrl}${pathname}`, {
    ...init,
    cache: 'no-store',
  });
  return await readJsonResponse(response, `Managed API request failed: HTTP ${response.status}`);
}

async function createElectronBillingCheckout(tier) {
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
      console.info('[electron:media:resolve-video-url:timeout]', {
        inputUrl,
        bvid,
        timeoutMs,
        durationMs: Date.now() - startedAt,
      });
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
      console.info('[electron:media:resolve-video-url:fallback]', {
        inputUrl,
        bvid,
        httpStatus: response.status,
        code: payload?.code ?? null,
        hasCid: Boolean(cid),
        stage,
        timeoutFired,
        durationMs: Date.now() - startedAt,
      });
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
    console.info('[electron:media:resolve-video-url:error]', {
      inputUrl,
      bvid,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : null,
      stage,
      timeoutFired,
      durationMs: Date.now() - startedAt,
    });
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
const { createMainWindow, resolveTargetWindow } = windowManager;
windowManager.registerWindowIpc(handleIpc);

registerDesktopIpc({
  handleIpc,
  normalizeExternalUrl,
  resolveTargetWindow,
  requireNonEmptyString,
  requireStringArray,
});

handleIpc('desktop:secrets:get-ai-provider-secrets', async (_event, providerIds) => {
  const { data } = await readSecretsStore();
  const result = {};

  for (const providerId of providerIds ?? []) {
    if (typeof providerId === 'string' && typeof data[providerId] === 'string') {
      result[providerId] = data[providerId];
    }
  }

  return result;
});

handleIpc('desktop:secrets:set-ai-provider-secret', async (_event, providerId, apiKey) => {
  const normalizedProviderId = requireNonEmptyString(providerId, 'provider id');

  const store = await readSecretsStore();
  store.data[normalizedProviderId] = String(apiKey ?? '');
  await writeSecretsStore(store.data);
});

handleIpc('desktop:secrets:delete-ai-provider-secret', async (_event, providerId) => {
  const normalizedProviderId = requireNonEmptyString(providerId, 'provider id');

  const store = await readSecretsStore();
  delete store.data[normalizedProviderId];
  await writeSecretsStore(store.data);
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

desktopAccountService.registerAccountIpc({ handleIpc });

registerManagedIpc({
  handleIpc,
  requestManagedJson,
  fetchWithStoredSession,
  managedApiBaseUrl,
  createElectronBillingCheckout,
  requireNonEmptyString,
});

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.vlaina.desktop');
  }

  const proxyConfig = await resolveProxyConfig();
  if (proxyConfig) {
    await session.defaultSession.setProxy({
      proxyRules: proxyConfig.proxyRules,
      proxyBypassRules: '127.0.0.1;localhost;<local>',
    });
  }

  session.defaultSession.webRequest.onErrorOccurred((details) => {
    if (!isVideoNetworkDebugUrl(details.url)) return;
    console.info('[electron:video-network:error]', {
      url: details.url,
      method: details.method,
      resourceType: details.resourceType,
      error: details.error,
      fromCache: details.fromCache,
    });
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);

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
