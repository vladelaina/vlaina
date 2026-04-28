import electron from 'electron';
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

desktopAccountService.registerAccountIpc({ handleIpc });

registerManagedIpc({
  handleIpc,
  requestManagedJson,
  fetchWithStoredSession,
  managedApiBaseUrl,
  createElectronBillingCheckout,
  requireNonEmptyString,
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.vlaina.desktop');
  }

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
